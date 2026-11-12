// প্রিমিয়াম কার্ড-স্টাইল (হোমের মতো): বড় গোল কোণ, প্রায়-অদৃশ্য বর্ডার, তিন-স্তর নরম ছায়া, হালকা গ্রেডিয়েন্ট।
// শুধু মান; কোনো state/logic নেই। থিম-সচেতন (--hs-* ভেরিয়েবল)। সব ট্যাবের তালিকা-কার্ড এখান থেকে নেবে।
export const PREMIUM_CARD = {
  background: "linear-gradient(180deg, var(--hs-surface, #fff), color-mix(in srgb, var(--hs-surface, #fff) 95%, var(--hs-primary, #0E4B43)))",
  border: "1px solid rgba(127,150,140,0.16)",
  borderRadius: "20px",
  boxShadow: "0 1px 2px rgba(14,75,67,0.05), 0 4px 10px rgba(14,75,67,0.05), 0 14px 30px rgba(14,75,67,0.08)",
};
