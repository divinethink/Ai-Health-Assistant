// নিজের notification-এর simple inline list — DailyTask NotificationPanel-এর
// click→mark-read/delete pattern থেকে adapt, কিন্তু dropdown/modal না রেখে
// বর্তমান Walking Skeleton-এর simple inline-block style-এর সাথে সংগতিপূর্ণ
// (Architecture Plan §11.1/§3.5.2)।

import { ErrorBox } from "../shared/ui.js";
import { listMyNotifications, markNotificationRead, deleteNotification } from "../legacy/notifications.js";

const { useState, useEffect, useCallback } = React;

export function NotificationsPanel({ familyId, uid }) {
  const [items, setItems] = useState(null);
  const [err, setErr] = useState(null);

  const reload = useCallback(() => {
    listMyNotifications(familyId, uid).then(setItems).catch((e) => setErr(e.message || String(e)));
  }, [familyId, uid]);

  useEffect(() => { reload(); }, [reload]);

  const onClick = useCallback(async (n) => {
    if (n.read) return;
    try { await markNotificationRead(familyId, n.id); reload(); } catch (e) { /* non-critical */ }
  }, [familyId, reload]);

  const onDelete = useCallback(async (id, e) => {
    e.stopPropagation();
    try { await deleteNotification(familyId, id); reload(); } catch (e2) { /* non-critical */ }
  }, [familyId, reload]);

  if (err) return ErrorBox(err);
  if (!items || items.length === 0) return null;

  return React.createElement(
    "div", { style: { marginTop: "14px" } },
    React.createElement("h3", { style: { fontSize: "15px", color: "#0E4B43" } }, "নোটিফিকেশন"),
    items.map((n) =>
      React.createElement(
        "div", {
          key: n.id,
          onClick: () => onClick(n),
          style: {
            padding: "8px", borderBottom: "1px solid #EEE", fontSize: "13px", cursor: "pointer",
            background: n.read ? "#fff" : "#F5F5F0",
            display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px",
          },
        },
        React.createElement("span", null, n.message),
        React.createElement("button", {
          onClick: (e) => onDelete(n.id, e),
          title: "ডিলিট করুন",
          style: { fontSize: "11px", color: "#888", background: "none", border: "none", cursor: "pointer" },
        }, "✕")
      )
    )
  );
}
