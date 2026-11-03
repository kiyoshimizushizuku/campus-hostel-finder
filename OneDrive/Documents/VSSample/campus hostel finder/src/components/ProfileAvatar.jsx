export default function ProfileAvatar({ imageUrl, name, active = false, size = "md" }) {
  const dimensions = size === "sm" ? "h-10 w-10" : "h-14 w-14";

  return (
    <span className={`relative inline-flex ${dimensions} shrink-0`}>
      {imageUrl
        ? <img src={imageUrl} alt={name || ""} className={`${dimensions} rounded-full object-cover`} />
        : <span aria-hidden="true" className={`${dimensions} rounded-full bg-white/15`} />}
      <span
        aria-label={active ? "Online" : "Offline"}
        title={active ? "Online" : "Offline"}
        className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#16241D] ${active ? "bg-emerald-400" : "bg-slate-400"}`}
      />
    </span>
  );
}
