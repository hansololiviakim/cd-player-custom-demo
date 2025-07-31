import { Routes, Route, Link } from "react-router-dom";
import One from "@/page/One";
import Two from "@/page/Two";

function App() {
  return (
    <main className="h-dvh bg-black">
      <Routes>
        <Route
          path="/"
          element={
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <h1 className="text-4xl font-bold text-white mb-8">
                  CD 플레이어 커스텀
                </h1>
                <div className="space-y-4">
                  <Link
                    to="/1st"
                    className="block w-64 bg-blue-500 text-white py-4 px-8 rounded-lg text-xl font-semibold hover:bg-blue-600 transition-colors"
                  >
                    버전 1
                  </Link>
                  <Link
                    to="/2nd"
                    className="block w-64 bg-green-500 text-white py-4 px-8 rounded-lg text-xl font-semibold hover:bg-green-600 transition-colors"
                  >
                    버전 2
                  </Link>
                </div>
              </div>
            </div>
          }
        />
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
