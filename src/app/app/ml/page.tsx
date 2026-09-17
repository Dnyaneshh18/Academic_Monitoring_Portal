"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/Shell";
import { api } from "@/lib/client";
import type { ClusterSummary, Confusion, RiskModel, StudentRisk } from "@/lib/risk";

export default function MlPage() {
  const [model, setModel] = useState<RiskModel | null>(null);
  const [clusters, setClusters] = useState<ClusterSummary[]>([]);
  const [students, setStudents] = useState<StudentRisk[]>([]);
  const [when, setWhen] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setBusy(true);
    try {
      const r = await api<{ model: RiskModel; clusters: ClusterSummary[]; students: StudentRisk[] }>("/api/risk");
      setModel(r.model || null);
      setClusters(r.clusters || []);
      setStudents((r.students || []).slice(0, 40));
      setWhen(new Date().toLocaleTimeString());
    } catch {
      /* keep last view */
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const cm: Confusion = model?.confusion || { tp: 0, fp: 0, tn: 0, fn: 0 };

  return (
    <div>
      <PageHeader
        kicker="Machine learning"
        title="Risk model report"
        hint="Logistic regression (supervised, 80/20 train–test) plus K-means clustering (unsupervised). Metrics below are on the held-out test set, not on training rows. Recalculates from current attendance and marks — nothing is stored as a frozen model."
        action={
          <button className="btn-accent" type="button" disabled={busy} onClick={() => load()}>
            {busy ? "Scoring…" : "Recalculate now"}
          </button>
        }
      />

      <div className="mb-6 rounded-2xl border border-ink-100 bg-white p-5 text-sm text-ink-700">
        <p className="font-semibold text-ink-900">How it works (viva)</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>
            Features per student: attendance gap, internals gap, weak-subject count, and{" "}
            <strong>decline</strong> (UT2 &lt; UT1, or last test &lt; first test).
          </li>
          <li>Label = at-risk if attendance ≤ 75% or internals &lt; 55% or a weak subject or decline.</li>
          <li>Shuffle (seed 42), train logistic regression on 80%, evaluate on 20%.</li>
          <li>Sigmoid + 80 epochs of gradient descent (learning rate 0.15), from scratch — no sklearn.</li>
          <li>K-means (k = 3) groups students into Regular / Watch / Critical.</li>
        </ol>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        {[
          ["Samples", model?.samples ?? "–"],
          ["Train / test", model ? `${model.trainSize} / ${model.testSize}` : "–"],
          ["Test accuracy", model ? `${model.accuracy}%` : "–"],
          ["Precision", model ? `${model.precision}%` : "–"],
          ["Recall / F1", model ? `${model.recall}% / ${model.f1}%` : "–"]
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-2xl border border-ink-100 bg-white p-4 shadow-card">
            <p className="text-xs uppercase tracking-wide text-ink-500">{label}</p>
            <p className="font-display mt-1 text-2xl">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-ink-100 bg-white p-5">
          <h2 className="font-display text-xl">Confusion matrix (test set)</h2>
          <p className="mt-1 text-xs text-ink-500">Predicted at-risk if probability ≥ 0.5</p>
          <table className="data mt-3">
            <thead>
              <tr>
                <th></th>
                <th>Pred at-risk</th>
                <th>Pred safe</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="font-medium">Actual at-risk</td>
                <td>TP {cm.tp}</td>
                <td>FN {cm.fn}</td>
              </tr>
              <tr>
                <td className="font-medium">Actual safe</td>
                <td>FP {cm.fp}</td>
                <td>TN {cm.tn}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="rounded-2xl border border-ink-100 bg-white p-5">
          <h2 className="font-display text-xl">Learned weights</h2>
          <p className="mt-1 text-xs text-ink-500">Larger weight → that gap pushes probability of at-risk up</p>
          <table className="data mt-3">
            <thead>
              <tr>
                <th>Term</th>
                <th>Weight</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Bias</td>
                <td>{model?.weights.bias ?? "–"}</td>
              </tr>
              <tr>
                <td>Attendance gap</td>
                <td>{model?.weights.attendanceGap ?? "–"}</td>
              </tr>
              <tr>
                <td>Internals gap</td>
                <td>{model?.weights.marksGap ?? "–"}</td>
              </tr>
              <tr>
                <td>Weak subjects</td>
                <td>{model?.weights.weakSubjects ?? "–"}</td>
              </tr>
              <tr>
                <td>Decline (UT1→UT2)</td>
                <td>{model?.weights.decline ?? "–"}</td>
              </tr>
            </tbody>
          </table>
        </section>
      </div>

      <section className="mt-6 rounded-2xl border border-ink-100 bg-white p-5">
        <h2 className="font-display text-xl">K-means clusters (k = 3)</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {clusters.map((c) => (
            <div key={c.name} className="rounded-xl border border-ink-100 bg-ink-50 p-4">
              <p className="text-xs uppercase tracking-wide text-brand-700">{c.name}</p>
              <p className="font-display mt-1 text-2xl">{c.count} students</p>
              <p className="mt-1 text-sm text-ink-600">
                Avg attendance {c.avgAttendance}% · avg internals {c.avgMarks}%
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-ink-100 bg-white p-5">
        <h2 className="font-display text-xl">Top scored students</h2>
        <div className="table-wrap mt-3">
          <table className="data">
            <thead>
              <tr>
                <th>Student</th>
                <th>Class</th>
                <th>Att %</th>
                <th>UT %</th>
                <th>Decline</th>
                <th>Cluster</th>
                <th>P(at-risk)</th>
                <th>Level</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.studentId}>
                  <td>
                    {s.name}
                    <div className="text-[11px] text-ink-400">Roll {s.rollNo}</div>
                  </td>
                  <td>{s.className}</td>
                  <td>{s.attendancePct}</td>
                  <td>{s.marksPct}</td>
                  <td>{s.decline ? "Yes" : "No"}</td>
                  <td>{s.cluster}</td>
                  <td>{s.score}</td>
                  <td>{s.level}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
