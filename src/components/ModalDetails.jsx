export default function DetailRow({ data = [] }) {
  return (
    <div className="border border-gray-300 rounded-3xl px-2 py-1">
      {data.map((item, index) => {
        const isLast = index === data.length - 1;

        return (
          <div key={index} className="group">
            <div className="flex items-center justify-between py-3.5 px-4 hover:bg-gray-50/50">
              <span className="text-xs font-medium uppercase tracking-widest text-gray-500">
                {item.label}
              </span>

              <span className="text-sm font-medium text-gray-800 tracking-wide">
                {item.value ?? "---"}
              </span>
            </div>

            {/* Divider: sirf last ke ilawa */}
            {!isLast && <hr className="border-gray-300 mx-1" />}
          </div>
        );
      })}
    </div>
  );
}
