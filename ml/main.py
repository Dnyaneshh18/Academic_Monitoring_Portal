"""
VIT Academic Monitoring Portal — Python ML microservice.

Flask REST API exposing POST /predict. The Next.js backend (src/lib/risk.ts)
POSTs raw feature rows (attendance %, marks %, weak-subject count, decline
flag, label) and this service trains a scikit-learn LogisticRegression risk
model plus KMeans student clustering, returning the exact JSON shape the
frontend depends on.

Run locally:
    pip install -r requirements.txt
    python main.py          # http://localhost:8000
"""

from decimal import Decimal, ROUND_HALF_UP

import numpy as np
from flask import Flask, jsonify, request
from sklearn.cluster import KMeans
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split

app = Flask(__name__)

CLUSTER_NAMES = ["Regular", "Watch", "Critical"]


# ---------------------------------------------------------------------------
# Rounding helpers — mirror the TypeScript implementation exactly
# (Math.round() is half-up; template-literal formatting drops trailing .0)
# ---------------------------------------------------------------------------

def _quant(x, q):
    v = float(Decimal(str(x)).quantize(Decimal(q), rounding=ROUND_HALF_UP))
    return 0.0 if v == 0 else v


def _r1(x):
    """1 decimal, half-up — TS: Math.round(x * 10) / 10"""
    return _quant(x, "0.1")


def _r3(x):
    """3 decimals, half-up — TS: Math.round(x * 1000) / 1000"""
    return _quant(x, "0.001")


def _rint(x):
    """Integer, half-up — TS: Math.round(x)"""
    return int(_quant(x, "1"))


def _fmt(x):
    """Format a number like a JS template literal (80 -> '80', 82.5 -> '82.5')."""
    x = float(x)
    return str(int(x)) if x == int(x) else str(x)


# ---------------------------------------------------------------------------
# Feature / rule helpers
# ---------------------------------------------------------------------------

def _features(row):
    """Normalized feature vector (matches src/lib/risk.ts xs())."""
    att = float(row.get("att") or 0.0)
    marks = float(row.get("marks") or 0.0)
    weak = int(row.get("weak") or 0)
    decline = int(row.get("decline") or 0)
    return [
        (100.0 - att) / 100.0,        # attendanceGap
        (100.0 - marks) / 100.0,      # marksGap
        min(weak, 4) / 4.0,           # weakSubjects (normalized)
        decline,                      # decline (0/1)
    ]


def _reasons(row):
    """Rule-based reasons list — matches TypeScript scoreStudents() exactly."""
    att = float(row.get("att") or 0.0)
    marks = float(row.get("marks") or 0.0)
    weak = int(row.get("weak") or 0)
    decline = int(row.get("decline") or 0)
    reasons = []
    if att < 75:
        reasons.append(f"Attendance {_fmt(_r1(att))}%")
    if marks < 60:
        reasons.append(f"UT average {_fmt(_r1(marks))}%")
    if decline:
        reasons.append("Scores falling test-to-test")
    if weak > 0:
        reasons.append(f"{weak} weak subject(s)")
    if not reasons:
        reasons.append("Pattern currently stable")
    return reasons


def _suggestion(row, level):
    """Counseling suggestion — matches TypeScript suggestion() exactly."""
    if level == "LOW":
        return None
    name = row.get("name") or "student"
    att = float(row.get("att") or 0.0)
    marks = float(row.get("marks") or 0.0)
    weak = int(row.get("weak") or 0)
    decline = int(row.get("decline") or 0)
    detail = []
    if att <= 75:
        detail.append(f"attendance {_fmt(_rint(att))}% (at or below 75%)")
    if marks < 55:
        detail.append(f"internal average {_fmt(_rint(marks))}%")
    if decline:
        detail.append("UT / internals falling test-to-test")
    if weak > 0:
        detail.append(f"{weak} subject(s) already in defaulter range")
    why = "; ".join(detail) if detail else "combined attendance and internals pattern"
    if att <= 75 and marks < 55:
        note = (
            f"ML risk model flagged {name}. Both attendance and internals are weak ({why}). "
            "Counsel on extra lectures and a remedial UT plan."
        )
        follow_up = "Review after next two weeks of attendance and UT2"
    elif att <= 75:
        note = (
            f"ML risk model flagged {name} for likely defaulter status ({why}). "
            "Discuss reasons for absence and set a recovery plan to reach 75%."
        )
        follow_up = "Recheck attendance after 2 weeks"
    else:
        note = (
            f"ML risk model flagged {name} for weak internals ({why}). "
            "Assign remedial problems and a mentor check before the next test."
        )
        follow_up = "Check next unit test score"
    return {"category": "ACADEMIC", "note": note, "followUp": follow_up}


def _empty_model():
    return {
        "samples": 0,
        "positives": 0,
        "trainSize": 0,
        "testSize": 0,
        "accuracy": 0.0,
        "precision": 0.0,
        "recall": 0.0,
        "f1": 0.0,
        "confusion": {"tp": 0, "fp": 0, "tn": 0, "fn": 0},
        "weights": {
            "bias": 0.0,
            "attendanceGap": 0.0,
            "marksGap": 0.0,
            "weakSubjects": 0.0,
            "decline": 0.0,
        },
    }


def _empty_clusters():
    return [{"name": n, "count": 0, "avgAttendance": 0.0, "avgMarks": 0.0} for n in CLUSTER_NAMES]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@app.route("/predict", methods=["POST"])
def predict():
    try:
        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            return jsonify({"error": "Request body must be a JSON object"}), 400

        raw_students = data.get("students")
        if raw_students is None:
            raw_students = []
        if not isinstance(raw_students, list):
            return jsonify({"error": "'students' must be a list"}), 400

        rows = []
        for s in raw_students:
            if not isinstance(s, dict):
                continue
            rows.append({
                "studentId": str(s.get("studentId") or ""),
                "name": str(s.get("name") or ""),
                "rollNo": str(s.get("rollNo") or ""),
                "className": str(s.get("className") or ""),
                "branch": str(s.get("branch") or ""),
                "att": float(s.get("att") or 0.0),
                "marks": float(s.get("marks") or 0.0),
                "weak": int(s.get("weak") or 0),
                "decline": 1 if int(s.get("decline") or 0) else 0,
                "label": 1 if int(s.get("label") or 0) else 0,
            })

        if not rows:
            return jsonify({"model": _empty_model(), "students": [], "clusters": _empty_clusters()})

        X = np.array([_features(r) for r in rows], dtype=float)
        y = np.array([r["label"] for r in rows], dtype=int)

        # Rule 10: fewer than 5 students → skip the split, train and test on all data.
        if len(rows) >= 5:
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=0.2, random_state=42, shuffle=True
            )
        else:
            X_train, X_test, y_train, y_test = X, X, y, y

        # Degenerate training set (single label): the model cannot learn —
        # fall back to zero weights so the endpoint still returns a valid shape.
        if len(set(y_train.tolist())) >= 2:
            lr = LogisticRegression(max_iter=1000, C=1.0, random_state=42)
            lr.fit(X_train, y_train)
            proba_all = lr.predict_proba(X)[:, 1]
            proba_test = lr.predict_proba(X_test)[:, 1]
            coef = [float(v) for v in lr.coef_[0]]
            intercept = float(lr.intercept_[0])
        else:
            proba_all = np.full(len(rows), 0.5)
            proba_test = np.full(len(y_test), 0.5)
            coef = [0.0, 0.0, 0.0, 0.0]
            intercept = 0.0

        pred_test = (proba_test >= 0.5).astype(int)
        tp = int(np.sum((pred_test == 1) & (y_test == 1)))
        fp = int(np.sum((pred_test == 1) & (y_test == 0)))
        tn = int(np.sum((pred_test == 0) & (y_test == 0)))
        fn = int(np.sum((pred_test == 0) & (y_test == 1)))

        n_test = len(y_test)
        accuracy = (tp + tn) / n_test * 100.0 if n_test else 0.0
        precision = tp / (tp + fp) * 100.0 if (tp + fp) else 0.0
        recall = tp / (tp + fn) * 100.0 if (tp + fn) else 0.0
        f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) else 0.0

        # KMeans clustering (unsupervised) on all rows. Sort clusters by
        # descending mean attendance → Regular / Watch / Critical.
        k = min(3, len(rows))
        kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
        labels = kmeans.fit_predict(X)

        per_cluster = []
        for c in range(k):
            idxs = np.where(labels == c)[0]
            count = int(idxs.size)
            mean_att = float(np.mean([rows[i]["att"] for i in idxs])) if count else float("-inf")
            per_cluster.append((mean_att, count, idxs))
        per_cluster.sort(key=lambda t: t[0], reverse=True)

        cluster_of = {}
        summaries = {}
        for pos, (_mean_att, count, idxs) in enumerate(per_cluster):
            name = CLUSTER_NAMES[pos]
            for i in idxs:
                cluster_of[i] = name
            summaries[name] = {
                "name": name,
                "count": count,
                "avgAttendance": _r1(float(np.mean([rows[i]["att"] for i in idxs]))) if count else 0.0,
                "avgMarks": _r1(float(np.mean([rows[i]["marks"] for i in idxs]))) if count else 0.0,
            }
        clusters = [
            summaries.get(name, {"name": name, "count": 0, "avgAttendance": 0.0, "avgMarks": 0.0})
            for name in CLUSTER_NAMES
        ]

        # Rule 7: risk-level thresholds applied on top of the model score.
        proba_all = np.asarray(proba_all, dtype=float)
        student_id_filter = data.get("studentId")

        students = []
        for i, row in enumerate(rows):
            att = row["att"]
            marks = row["marks"]
            weak = row["weak"]
            decline = row["decline"]
            score = _r3(float(proba_all[i]))
            if att < 60 or (decline == 1 and att < 75) or marks < 50 or score >= 0.85:
                level = "HIGH"
            elif att < 75 or marks < 60 or decline == 1 or score >= 0.55:
                level = "MEDIUM"
            else:
                level = "LOW"
            students.append({
                "studentId": row["studentId"],
                "name": row["name"],
                "rollNo": row["rollNo"],
                "className": row["className"],
                "branch": row["branch"],
                "attendancePct": _r1(att),
                "marksPct": _r1(marks),
                "weakSubjects": weak,
                "decline": bool(decline),
                "cluster": cluster_of.get(i, "Watch"),
                "score": score,
                "level": level,
                "reasons": _reasons(row),
                "suggestion": _suggestion(row, level),
            })

        # Rule 12: studentId filter narrows the returned students only.
        if student_id_filter is not None and student_id_filter != "":
            students = [s for s in students if s["studentId"] == str(student_id_filter)]

        # Rule 11: sort by score descending.
        students.sort(key=lambda s: s["score"], reverse=True)

        model_out = {
            "samples": len(rows),
            "positives": int(np.sum(y == 1)),
            "trainSize": len(y_train),
            "testSize": len(y_test),
            "accuracy": _r1(accuracy),
            "precision": _r1(precision),
            "recall": _r1(recall),
            "f1": _r1(f1),
            "confusion": {"tp": tp, "fp": fp, "tn": tn, "fn": fn},
            "weights": {
                "bias": _r3(intercept),
                "attendanceGap": _r3(coef[0]),
                "marksGap": _r3(coef[1]),
                "weakSubjects": _r3(coef[2]),
                "decline": _r3(coef[3]),
            },
        }

        return jsonify({"model": model_out, "students": students, "clusters": clusters})
    except Exception as e:  # noqa: BLE001 — report any failure as HTTP 500
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=False)
