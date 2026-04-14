import { useState } from "react";

export default function EditPanel({ selectedDress, onEdit }) {
  const [text, setText] = useState("");

  if (!selectedDress) {
    return (
      <div className="p-4 border border-white/10 rounded-2xl">
        Select a dress to start editing
      </div>
    );
  }

  return (
    <div className="p-4 border border-white/10 rounded-2xl">
      <h3 className="text-white mb-2">Edit Dress</h3>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="make it blue..."
        className="w-full p-3 rounded bg-black text-white"
      />

      <button
        onClick={() => onEdit(text)}
        className="mt-3 px-4 py-2 bg-cyan-500 rounded text-white"
      >
        Apply Edit
      </button>
    </div>
  );
}