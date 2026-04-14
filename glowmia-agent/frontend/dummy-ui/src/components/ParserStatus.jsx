export default function ParserStatus({ parserUsed, parserError }) {
  if (!parserUsed) return null;

  return (
    <div className="bg-white/5 border border-white/10 p-4 rounded-2xl mt-4">
      <p className="text-sm">
        Parser used: <span className="text-cyan-300 font-semibold">{parserUsed}</span>
      </p>

      {parserError && (
        <p className="text-red-300 text-sm mt-2">
          LLM failed: {parserError}
        </p>
      )}
    </div>
  );
}