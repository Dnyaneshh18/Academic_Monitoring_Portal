import nodemailer from "nodemailer";

export function smtpConfigured() {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
}

export function parentAlertDraft(opts: {
  studentName: string;
  prn: string;
  className: string;
  attendancePct: number;
  marks: string;
  reasons: string[];
  collegeName?: string;
  teacherName?: string;
  teacherEmail?: string;
  teacherPhone?: string;
  teacherDesignation?: string;
  teacherDept?: string;
}) {
  const college = opts.collegeName || "the institute";
  const teacherName = opts.teacherName || "Subject faculty";
  const teacherLines = [
    `Faculty: ${teacherName}`,
    opts.teacherDesignation ? `Designation: ${opts.teacherDesignation}` : "",
    opts.teacherDept ? `Department: ${opts.teacherDept}` : "",
    opts.teacherEmail ? `Email: ${opts.teacherEmail}` : "",
    opts.teacherPhone ? `Mobile: ${opts.teacherPhone}` : ""
  ]
    .filter(Boolean)
    .join("\n");

  const subject = `Academic concern — ${opts.studentName} (${opts.className})`;
  const body = `Dear Parent / Guardian,

This is an academic alert from the Academic Monitoring Portal, ${college}.

Student: ${opts.studentName}
PRN: ${opts.prn || "—"}
Class: ${opts.className}

Our monitoring model has flagged a concern:
• Attendance: ${opts.attendancePct}% (minimum expected is 75%)
• Recent internals: ${opts.marks}
• Reasons: ${opts.reasons.join("; ") || "falling scores and/or poor attendance"}

Please speak with your ward. To discuss a recovery plan, contact the faculty who sent this alert:

${teacherLines}

You may reply to this email to reach the faculty directly.

Regards,
${teacherName}
${opts.teacherDesignation ? opts.teacherDesignation + "\n" : ""}${college}
`;
  return { subject, body };
}

export async function sendMail(to: string, subject: string, text: string, replyTo?: string) {
  if (!smtpConfigured()) {
    return { ok: false as const, error: "SMTP not configured. Add SMTP_USER and SMTP_PASS (Gmail app password)." };
  }
  const user = process.env.SMTP_USER as string;
  const pass = (process.env.SMTP_PASS || "").replace(/\s/g, "");
  const from = process.env.SMTP_FROM || `Academic Portal <${user}>`;

  const attempts = [
    { service: "gmail" as const, auth: { user, pass } },
    {
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user, pass }
    },
    {
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: Number(process.env.SMTP_PORT || 587),
      secure: false,
      requireTLS: true,
      auth: { user, pass }
    }
  ];

  let last = "Could not send mail";
  for (const opts of attempts) {
    try {
      const transporter = nodemailer.createTransport(opts);
      await transporter.sendMail({ from, to, subject, text, replyTo: replyTo || from });
      return { ok: true as const };
    } catch (e) {
      last = e instanceof Error ? e.message : String(e);
    }
  }
  return { ok: false as const, error: last };
}
