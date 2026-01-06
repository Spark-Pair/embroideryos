export default function TableSkeleton({ rows = 5 }) {
  return (
    <tbody>
      {[...Array(rows)].map((_, i) => (
        <tr key={i} className="animate-pulse">
          {[...Array(6)].map((_, j) => (
            <td key={j} className="px-7 py-4">
              <div className="h-4 bg-gray-200 rounded w-full"></div>
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}
