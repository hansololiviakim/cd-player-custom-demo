import { Routes, Route, Link } from "react-router-dom";
import Home from "@/page/Home";

function App() {
  return (
    <main className="h-dvh bg-black">
      <Routes>
        <Route path="/" element={<Home />} />
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
