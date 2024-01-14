import React, { useState, useEffect, useContext } from 'react';
import ModeContext from './ModeContext';
import ConnectedContext from './ConnectedContext';

const ConnectionStatus = () => {
    const [timeoutReached, setTimeoutReached] = useState(false);
    const [discovering, setDiscovering] = useState(true);
    const { selectedMode } = useContext(ModeContext);
    const { connected, setConnected } = useContext(ConnectedContext);

    useEffect(() => {
        const timer = setTimeout(() => {
            setTimeoutReached(true);
            setDiscovering(false);
        }, 30000);

        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        const ws = new WebSocket('ws://localhost:3000');

        ws.addEventListener('message', () => {
            setConnected(true);
        });

        return () => {
            ws.close();
        };
    }, [selectedMode]);

    useEffect(() => {
        if (connected) {
            setDiscovering(false);
        }
        if (!connected) {
            setDiscovering(true);
        }
    }, [connected]);

    const text = connected
        ? `We're connected to your ${selectedMode} instance.`
        : timeoutReached
            ? "We're having trouble connecting. Please reach out to us for support."
            : `We're connecting to your ${selectedMode} instance`;

    return (
        <div className="flex flex-col items-center justify-center min-w-max">
            <p className="text-lg font-bold">{text}</p>
            <div className="relative grid place-items-center h-16 w-16">
                {discovering && (
                    <span className="relative grid place-items-center h-6 w-6">
                <span
                    className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-6 w-6 bg-indigo-500"></span>
            </span>
                )}
                {!discovering && (
                    <span className="relative grid place-items-center h-6 w-6">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    connected ? 'bg-green-500' : 'bg-red-500'
                }`}></span>
                <span className={`relative inline-flex rounded-full h-6 w-6 ${
                    connected ? 'bg-green-500' : 'bg-red-500'
                }`}></span>
            </span>
                )}
            </div>
        </div>
    );
};

export default ConnectionStatus;