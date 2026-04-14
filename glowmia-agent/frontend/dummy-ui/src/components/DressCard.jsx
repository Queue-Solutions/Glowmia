export default function DressCard({ dress, isSelected, onSelect }) {
  return (
    <div
      onClick={() => onSelect(dress)}
      className={`cursor-pointer border rounded-2xl overflow-hidden ${
        isSelected ? "border-cyan-400" : "border-white/10"
      }`}
    >
      <img
        src={dress.image_url}
        className="w-full h-64 object-cover"
      />

      <div className="p-3">
        <h3 className="text-white font-semibold">{dress.name}</h3>
        <p className="text-sm text-slate-400">{dress.color}</p>
      </div>
    </div>
  );
}