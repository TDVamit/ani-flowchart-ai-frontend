interface DailyNotesInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: number;
}

export default function DailyNotesInput({
  label,
  value,
  onChange,
  placeholder,
  minHeight = 200,
}: DailyNotesInputProps) {
  return (
    <div>
      <label className="block font-mono text-xs text-indigo-600 font-bold uppercase tracking-widest mb-2">
        {label}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-white border border-[#e2e8f0] text-[#1e293b] text-sm p-3 resize-y rounded focus:outline-none focus:border-indigo-400 transition-colors placeholder-gray-400"
        style={{ minHeight }}
      />
    </div>
  );
}
