export default function Toast({ type = "success", message }) {
  const styles = {
    success: "bg-green-600 text-white",
    error: "bg-red-600 text-white",
    info: "bg-blue-600 text-white",
  };

  return (
    <div
      className={`px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 ${styles[type]}`}
    >
      <span className="font-semibold">
        {type === "success" && "✔"}
        {type === "error" && "✖"}
        {type === "info" && "ℹ"}
      </span>
      <span>{message}</span>
    </div>
  );
}
