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

import base64
import io
import os
import re
from collections import Counter
from decimal import Decimal, ROUND_HALF_UP

import numpy as np
from flask import Flask, jsonify, request
from sklearn.cluster import KMeans
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.model_selection import train_test_split

try:  # pypdf is optional at import time — PDF text extraction degrades gracefully
    from pypdf import PdfReader
except Exception:  # noqa: BLE001
    PdfReader = None

try:  # sentence-transformers is optional — the service falls back to TF-IDF
    from sentence_transformers import SentenceTransformer
except Exception:  # noqa: BLE001
    SentenceTransformer = None

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
# Assignment auto-evaluation (dual-engine NLP, 100% local)
# ---------------------------------------------------------------------------

# Lazy SentenceTransformer singleton — loaded once on first use. If the
# library or the model is unavailable, evaluation falls back to TF-IDF.
_st_model = None
_st_tried = False

STOPWORDS = frozenset(
    """a an the and or but if then else of to in on at for with by from as is are was were be
    been being this that these those it its i you he she they we his her their our your my
    not no do does did done have has had will would can could should may might must about into
    over under between within without among each other more most much many very just also
    such only own same so than too well even still however because while which who whom whose
    there here what when where why""".split()
)


def _get_st_model():
    global _st_model, _st_tried
    if _st_tried:
        return _st_model
    _st_tried = True
    if SentenceTransformer is None:
        return None
    try:
        _st_model = SentenceTransformer("all-MiniLM-L6-v2")
        print("[evaluate-assignment] SentenceTransformer model loaded.")
    except Exception as e:  # noqa: BLE001
        _st_model = None
        print("[evaluate-assignment] SentenceTransformer unavailable — using TF-IDF fallback:", e)
    return _st_model


def extract_text_from_pdf(data) -> str:
    """Extract text from PDF bytes or a file path using pypdf."""
    if PdfReader is None:
        raise RuntimeError("pypdf is not installed")
    if isinstance(data, (str, os.PathLike)):
        with open(data, "rb") as fh:
            reader = PdfReader(fh)
    else:
        reader = PdfReader(io.BytesIO(data))
    parts = []
    for page in reader.pages:
        try:
            parts.append(page.extract_text() or "")
        except Exception:  # noqa: BLE001 — skip unreadable pages
            parts.append("")
    return "\n".join(parts).strip()


def _extract_keywords(text: str, limit: int = 8):
    """Frequency-ranked keyword extraction from the model answer text."""
    words = re.findall(r"[a-zA-Z][a-zA-Z0-9\-']{2,}", text.lower())
    freq: dict = {}
    order: dict = {}
    for i, w in enumerate(words):
        if w in STOPWORDS or w.isdigit():
            continue
        freq[w] = freq.get(w, 0) + 1
        order.setdefault(w, i)
    ranked = sorted(freq, key=lambda w: (-freq[w], order[w]))
    return ranked[:limit]


def _keyword_coverage(text: str, keywords):
    """Keywords found in the student text (word-boundary, case-insensitive)."""
    text_l = text.lower()
    matched = []
    for kw in keywords:
        kw_l = str(kw).lower().strip()
        if not kw_l:
            continue
        if re.search(r"\b" + re.escape(kw_l) + r"\b", text_l):
            matched.append(kw)
    return matched



def _build_reference(title, instructions, model_answer, keywords):
    """Build a rich reference text from ALL available assignment fields.

    Combines title, instructions, model answer, and keywords so the
    TF-IDF / semantic engine has enough context to produce meaningful
    similarity scores even when only the title is available.
    """
    parts = []
    if title and str(title).strip():
        parts.append(str(title).strip())
    if instructions and str(instructions).strip():
        parts.append(str(instructions).strip())
    if model_answer and str(model_answer).strip():
        parts.append(str(model_answer).strip())
    if keywords:
        kw_text = " ".join(str(k).strip() for k in keywords if str(k).strip())
        if kw_text:
            parts.append(kw_text)
    return "\n".join(parts).strip()


def _plagiarism_check(text, reference):
    """Plagiarism detection (0.0 = heavy copying, 1.0 = fully original).

    Only penalizes:
    - Self-repetition: same sentence appearing multiple times
    - Verbatim copying: >50% of sentences are exact matches in reference
    - Long identical n-grams (5+ words) copied from reference

    Does NOT penalize:
    - Using similar terminology (expected for correct answers)
    - Short phrase overlap (3-4 words)
    """
    if not text or not text.strip():
        return 0.0

    sentences = [s.strip() for s in re.split(r'[.!?]+', text) if len(s.strip()) > 10]
    if len(sentences) < 2:
        # Very short text — can't assess plagiarism, give neutral score
        return 0.7

    # Self-repetition: count duplicate sentences
    sent_counts = Counter(s.lower() for s in sentences)
    repeated_count = sum(c - 1 for c in sent_counts.values() if c > 1)
    self_repeat_ratio = repeated_count / len(sentences)

    # Exact sentence matches with reference (verbatim copying)
    ref_lower = reference.lower() if reference else ""
    # Normalize whitespace for fair comparison
    ref_norm = re.sub(r'\s+', ' ', ref_lower).strip()
    exact_matches = sum(1 for s in sentences if re.sub(r'\s+', ' ', s.lower()).strip() in ref_norm)
    copy_ratio = exact_matches / len(sentences)

    # Long n-gram overlap (5+ words) — only flags actual copying, not terminology
    ref_words = ref_norm.split()
    ref_ngrams = set()
    for i in range(len(ref_words) - 4):
        ref_ngrams.add(" ".join(ref_words[i:i+5]))

    text_words = re.sub(r'\s+', ' ', text.lower()).split()
    text_ngrams = []
    for i in range(len(text_words) - 4):
        text_ngrams.append(" ".join(text_words[i:i+5]))

    if text_ngrams:
        long_ngram_overlap = sum(1 for ng in text_ngrams if ng in ref_ngrams) / len(text_ngrams)
    else:
        long_ngram_overlap = 0.0

    # Score: penalize self-repetition and verbatim copying
    # 1.0 = fully original, 0.0 = heavily copied
    score = 1.0
    score -= self_repeat_ratio * 0.3       # self-repetition penalty
    score -= copy_ratio * 0.5              # verbatim copy penalty (heavily weighted)
    score -= max(0.0, long_ngram_overlap - 0.2) * 0.5  # long n-gram overlap (only above 20%)

    return max(0.0, min(1.0, score))


def _semantic_scores(reference: str, submission_texts):
    """Cosine similarity between each submission and the reference answer.

    Engine 1: SentenceTransformer('all-MiniLM-L6-v2') embeddings.
    Engine 2 (fallback): TF-IDF vectorizer + cosine similarity.
    Engine 3 (fallback): Word overlap ratio.
    """
    model = _get_st_model()
    if model is not None:
        try:
            emb = model.encode([reference] + submission_texts, normalize_embeddings=True, convert_to_numpy=True)
            sims = []
            for i in range(len(submission_texts)):
                sim = float(np.dot(emb[0], emb[i + 1]))
                sims.append(max(0.0, min(1.0, sim)))
            return sims
        except Exception as e:  # noqa: BLE001 — half-initialized model → fall back
            print("[evaluate-assignment] SentenceTransformer encoding failed — using TF-IDF fallback:", e)

    # TF-IDF — do NOT use stop_words="english" (removes technical terms)
    corpus = [reference] + submission_texts
    try:
        tf = TfidfVectorizer(lowercase=True, token_pattern=r"(?u)\b\w[\w\-']+\b").fit_transform(corpus)
        sims = cosine_similarity(tf[0:1], tf[1:]).flatten()
    except ValueError:  # empty vocabulary
        sims = [0.0] * len(submission_texts)

    # TF-IDF cosine is naturally low for short texts — blend with word overlap
    result = []
    for i, s in enumerate(sims):
        s = max(0.0, min(1.0, float(s)))
        # Word overlap: fraction of reference words found in submission
        ref_words = set(re.findall(r"[a-zA-Z][a-zA-Z0-9\-']{2,}", reference.lower()))
        sub_words = set(re.findall(r"[a-zA-Z][a-zA-Z0-9\-']{2,}", submission_texts[i].lower()))
        if ref_words:
            overlap = len(ref_words & sub_words) / len(ref_words)
        else:
            overlap = 0.0
        # Blend: 60% TF-IDF, 40% word overlap — both should agree for good answers
        blended = s * 0.6 + overlap * 0.4
        # If TF-IDF is very low but word overlap is decent, trust the overlap more
        if s < 0.1 and overlap > 0.2:
            blended = overlap * 0.7
        result.append(max(0.0, min(1.0, blended)))
    return result


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


@app.route("/evaluate-assignment", methods=["POST"])
def evaluate_assignment():
    """Score student submissions against a model answer / keyword list.

    Body:
      {
        "max_marks": 10,
        "model_answer": "...",                    # optional (else keywords)
        "keywords": ["array", "pointer"],        # optional (else extracted)
        "submissions": [{"student_id": "st_1",    # or "submission_id"
                          "text": "...",          # pre-extracted text
                          "pdf_base64": "..."}]   # or raw PDF (extracted via pypdf)
      }
    Returns: {"results": [{student_id, submission_id?, obtained,
                            semantic_score, keyword_score, completeness_score,
                            matched_keywords, remark}]}
    """
    try:
        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            return jsonify({"error": "Request body must be a JSON object"}), 400

        max_marks = float(data.get("max_marks") or 0)
        if max_marks <= 0:
            return jsonify({"error": "max_marks must be greater than 0"}), 400

        title = str(data.get("title") or "").strip()
        instructions = str(data.get("instructions") or "").strip()
        model_answer = str(data.get("model_answer") or "").strip()
        keywords_raw = data.get("keywords") or []
        if not isinstance(keywords_raw, list):
            keywords_raw = []
        keywords = [str(k).strip() for k in keywords_raw if str(k).strip()]

        submissions = data.get("submissions") or []
        if not isinstance(submissions, list):
            return jsonify({"error": "'submissions' must be a list"}), 400

        # Build a rich reference from ALL available assignment fields
        reference = _build_reference(title, instructions, model_answer, keywords)
        if not reference:
            return jsonify({"error": "Provide a title, instructions, model answer, or keywords to evaluate against"}), 400

        keywords = keywords or _extract_keywords(reference)

        # Resolve each submission to text (extract PDF text when needed).
        items = []
        for s in submissions:
            if not isinstance(s, dict):
                continue
            sid = str(s.get("student_id") or s.get("submission_id") or "")
            text = str(s.get("text") or "").strip()
            if not text and s.get("pdf_base64"):
                try:
                    text = extract_text_from_pdf(base64.b64decode(s["pdf_base64"]))
                except Exception:  # noqa: BLE001 — unreadable PDF → empty text
                    text = ""
            items.append({
                "student_id": sid,
                "submission_id": str(s.get("submission_id") or "") or None,
                "text": text,
            })

        if not items:
            return jsonify({"results": []})

        # Semantic similarity for all submissions with readable text.
        semantic_by_pos = {}
        readable = [it["text"] for it in items if it["text"]]
        if readable:
            sims = _semantic_scores(reference, readable)
            pos = 0
            for i, it in enumerate(items):
                if it["text"]:
                    semantic_by_pos[i] = sims[pos]
                    pos += 1

        results = []
        for i, it in enumerate(items):
            sid = it["student_id"]
            if not it["text"]:
                results.append({
                    "student_id": sid,
                    "obtained": 0.0,
                    "semantic_score": 0.0,
                    "keyword_score": 0.0,
                    "completeness_score": 0.0,
                    "plagiarism_score": 0.0,
                    "matched_keywords": [],
                    "remark": "Auto-evaluated: No readable text found in submission."
                })
                continue

            sem = semantic_by_pos[i]
            matched = _keyword_coverage(it["text"], keywords)
            kw_score = len(matched) / len(keywords) if keywords else None

            # Completeness: blend of length ratio and concept coverage
            # Length ratio: how much of the reference length the student covered
            len_ratio = min(len(it["text"]) / max(len(reference), 1), 1.0)
            # Concept coverage: how many reference concepts the student addressed
            ref_words = set(re.findall(r"[a-zA-Z][a-zA-Z0-9\-']{2,}", reference.lower()))
            sub_words = set(re.findall(r"[a-zA-Z][a-zA-Z0-9\-']{2,}", it["text"].lower()))
            concept_cov = len(ref_words & sub_words) / max(len(ref_words), 1) if ref_words else 0.0
            # Blend: 50% length, 50% concept coverage
            completeness = len_ratio * 0.5 + concept_cov * 0.5

            plagiarism_score = _plagiarism_check(it["text"], reference)

            # Scoring weights (revised for fairness):
            #   semantic    : 40% — how well the answer aligns with the assignment
            #   keyword     : 25% — coverage of key concepts
            #   completeness: 25% — concept coverage and adequate depth
            #   plagiarism  : 10% — originality (penalises copying)
            if kw_score is None:
                # No keywords: redistribute weight across semantic, completeness, plagiarism
                combined = sem * 0.60 + completeness * 0.30 + plagiarism_score * 0.10
            else:
                combined = sem * 0.40 + kw_score * 0.25 + completeness * 0.25 + plagiarism_score * 0.10

            combined = max(0.0, min(1.0, combined))

            # Minimum score floor: if the student wrote readable text and has
            # ANY keyword match or word overlap, they deserve at least some marks.
            min_floor = 0.0
            if matched:
                # Matched at least one keyword → floor based on coverage
                min_floor = max(min_floor, (len(matched) / max(len(keywords), 1)) * 0.5)
            # Word overlap with reference
            ref_word_set = set(re.findall(r"[a-zA-Z][a-zA-Z0-9\-']{2,}", reference.lower()))
            sub_word_set = set(re.findall(r"[a-zA-Z][a-zA-Z0-9\-']{2,}", it["text"].lower()))
            if ref_word_set:
                overlap_ratio = len(ref_word_set & sub_word_set) / len(ref_word_set)
                if overlap_ratio > 0.1:
                    min_floor = max(min_floor, overlap_ratio * 0.5)
            combined = max(combined, min_floor)

            match_pct = _r1(combined * 100.0)
            obtained = _r1(combined * max_marks)

            if match_pct >= 85:
                note = "Strong match."
            elif match_pct >= 60:
                note = "Partial match — review weak areas."
            else:
                note = "Weak match — review required."

            kw_note = (
                f" (Keywords: {len(matched)}/{len(keywords)} found: [{', '.join(matched)}])"
                if keywords
                else ""
            )

            plag_note = ""
            if plagiarism_score < 0.4:
                plag_note = " ⚠ Possible plagiarism detected."
            elif plagiarism_score < 0.7:
                plag_note = " (Some copied content detected.)"

            result = {
                "student_id": sid,
                "obtained": obtained,
                "semantic_score": _r3(sem),
                "keyword_score": _r3(kw_score if kw_score is not None else 0.0),
                "completeness_score": _r3(completeness),
                "plagiarism_score": _r3(plagiarism_score),
                "matched_keywords": matched,
                "remark": f"Auto-evaluated: {match_pct}% match. {note}{kw_note}{plag_note}",
            }
            if it.get("submission_id"):
                result["submission_id"] = it["submission_id"]
            results.append(result)

        # Debug logging — print every score so the terminal shows what happened
        for r in results:
            print(f"[evaluate-assignment] student={r['student_id']} obtained={r['obtained']} "
                  f"sem={r['semantic_score']} kw={r['keyword_score']} comp={r['completeness_score']} "
                  f"plag={r['plagiarism_score']} matched={r['matched_keywords']} "
                  f"remark={r['remark']}")

        return jsonify({"results": results})
    except Exception as e:  # noqa: BLE001 — report any failure as HTTP 500
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=False)
