import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Bookshelf from './pages/Bookshelf';
import Reader from './pages/Reader';
import Settings from './pages/Settings';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Bookshelf />} />
        <Route path="/reader" element={<Reader />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </BrowserRouter>
  );
}
