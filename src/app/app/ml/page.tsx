"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import type { ClusterSummary, StudentRisk } from "@/lib/risk";

export default function MlPage() {
  const [clusters, setClusters] = useState<ClusterSummary[]>([]);
  const [students, setStudents] = useState<StudentRisk[]>([]);

  async function load() {
    try {
      const r = await api<{ clusters: ClusterSummary[]; students: StudentRisk[] }>("/api/risk");
      setClusters(r.clusters || []);
      setStudents((r.students || []).slice(0, 40));
    } catch {
      /* keep last view */
    }
  }

  useEffect(() => {
    load();
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  return (
    <div>
      <section className="mt-0 glass p-5">
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

      <section className="mt-6 glass p-5">
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
