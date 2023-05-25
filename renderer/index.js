import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import {UserProvider} from './UserContext';


const root = document.getElementById('app');
ReactDOM.createRoot(root).render(<UserProvider>
    <App/>
</UserProvider>);