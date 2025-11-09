import { useState } from "preact/hooks";

export default function Counter() {
  const [count, setCount] = useState(0);
  return (
    <button
      class="bg-blue-500 text-white px-4 py-2 rounded"
      onClick={() => setCount(count + 1)}
    >
      Count: {count}
    </button>
  );
}
