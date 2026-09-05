import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App';
import './styles/global.css';

/** Vite 浏览器入口，挂载 PawID 纯前端演示应用。 */
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
