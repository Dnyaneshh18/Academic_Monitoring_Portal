"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/Shell";
import { api } from "@/lib/client";

const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT"];

type Slot = { id: string; day: string; start_time: string; end_time: string; room: string; subject_name: string; subject_code: string };

export default function TimetablePage() {
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [classId, setClassId] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);

  useEffect(() => {
    api<{ classes: { id: string; name: string }[] }>("/api/catalog")
      .then((c) => {
        setClasses(c.classes || []);
        if (c.classes?.[0]) setClassId(c.classes[0].id);
      })
      .catch(() => setClasses([]));
  }, []);

  useEffect(() => {
    if (!classId) return;
    api<Slot[]>(`/api/timetable?classId=${classId}`)
      .then(setSlots)
      .catch(() => setSlots([]));
  }, [classId]);

  const times = Array.from(new Set(slots.map((s) => `${s.start_time}-${s.end_time}`))).sort();

  return (
    <div>
      <PageHeader
        kicker="Weekly grid"
        title="Timetable"
        action={
          <select className="field max-w-xs" value={classId} onChange={(e) => setClassId(e.target.value)}>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        }
      />
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Time</th>
              {DAYS.map((d) => (
                <th key={d}>{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {times.map((t) => (
              <tr key={t}>
                <td className="whitespace-nowrap font-medium">{t}</td>
                {DAYS.map((d) => {
                  const cell = slots.find((s) => s.day === d && `${s.start_time}-${s.end_time}` === t);
                  return (
                    <td key={d}>
                      {cell ? (
                        <div>
                          <p className="text-xs font-semibold">{cell.subject_code}</p>
                          <p className="text-xs text-ink-600">{cell.subject_name}</p>
                          <p className="text-[10px] text-ink-400">{cell.room}</p>
                        </div>
                      ) : (
                        <span className="text-ink-300">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
