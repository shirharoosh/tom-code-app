import { BrowserRouter, Routes, Route } from "react-router-dom";
import Lobby from "./pages/Lobby";
import CodeEditor from "./pages/CodeEditor";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Lobby />} />
        <Route path="/code/:id" element={<CodeEditor />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;