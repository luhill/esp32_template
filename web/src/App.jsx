// import "./css/App.css";

// import Home from "./pages/Home";
// import Settings from "./pages/Settings";
// import Update from "./pages/Update";

// //import { Routes, Route } from "react-router-dom";
// import { HashRouter as Router, Routes, Route } from 'react-router-dom';
// import { ESPProvider } from "./contexts/ESPContext";
// import NavBar from "./components/NavBar";

// function App() {
//   return (
//     <ESPProvider>
//       <NavBar />
//       <main className="main-content">
//         <Routes>
//           <Route path="/" element={<Home />} />
//           <Route path="/settings" element={<Settings />} />
//           <Route path="/upload" element={<Update />} />
//         </Routes>
//       </main>
//     </ESPProvider>
//   );
// }

// export default App;
import "./css/App.css";
import Home from "./pages/Home";
import Settings from "./pages/Settings";
import Update from "./pages/Update";
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { ESPProvider } from "./contexts/ESPContext";
import NavBar from "./components/NavBar";

function App() {
  return (
    <ESPProvider>
      {/* 1. The Router MUST wrap everything that uses navigation (NavBar + Routes) */}
      <Router>
        <NavBar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/update" element={<Update />} />
            
            {/* 2. Pro-Tip: Add a fallback for broken URLs */}
            {/* <Route path="*" element={<Home />} /> */}
          </Routes>
        </main>
      </Router>
    </ESPProvider>
  );
}

export default App;