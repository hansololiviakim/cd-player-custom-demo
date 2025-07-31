import { Routes, Route, Link } from "react-router-dom";
import One from "@/page/One";
import Two from "@/page/Two";

function App() {
  return (
    <main className="h-dvh bg-black">
      <Routes>
        <Route path="/1st" element={<One />} />
        <Route path="/2nd" element={<Two />} />
        <Route
          path="*"
          element={
            <h2 className="h-full flex items-center justify-center">
              페이지를 찾을 수 없습니다.
            </h2>
          }
        />
      </Routes>
    </main>
  );
}

export default App;
