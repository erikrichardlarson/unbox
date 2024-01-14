import React, { useRef, useEffect, useCallback, useState } from 'react';
import { debounce } from 'lodash';
import { ColorProvider } from "./ColorContext";
import ASOT from "./ASOT";
import ConnectionStatus from "./ConnectionStatus";


export default function GoLive() {
    const localOverlayRef = useRef();
    const remoteOverlayRef = useRef();
    const localAlbumArtRef = useRef();
    const remoteAlbumArtRef = useRef();
    const [localOverlay, setLocalOverlay] = useState('');
    const [remoteOverlay, setRemoteOverlay] = useState('');
    const [toastVisible, setToastVisible] = useState(false);
    const [localAlbumArt, setLocalAlbumArt] = useState('');
    const [remoteAlbumArt, setRemoteAlbumArt] = useState('');

    const getComponentByName = (name) => {
        switch (name) {
            case "ASOT":
                return ASOT;
            default:
                return ASOT;
        }
    };

    const [selectedOption, setSelectedOption] = useState(
        window.electron.store.get("overlay") || 'ASOT'
    );

    useEffect(() => {
        (async () => {
            if (window.electron) {
                const localIP = await window.electron.invoke('local-ip');
                setLocalOverlay(
                    'http://localhost:8001/unbox_overlay.html'
                );
                setRemoteOverlay(
                    `http://${localIP}:8001/unbox_overlay.html`
                );

                setLocalAlbumArt(
                    'http://localhost:8001/album_art.html'
                );
                setRemoteAlbumArt(
                    `http://${localIP}:8001/album_art.html`
                );
            }
        })();
    }, []);

    const copyToClipboard = async (inputRef, option, optionKey) => {
        const textToCopy = inputRef.current.value;

        try {
            await navigator.clipboard.writeText(textToCopy);

            if (window.electron && window.electron.store) {
                window.electron.store.set(optionKey, option);
            }

            setToastVisible(true);
            setTimeout(() => {
                setToastVisible(false);
            }, 3000);
        } catch (err) {
            console.error('Failed to copy text: ', err);
        }
    };

    const handleInputChange = useCallback(
        debounce((optionKey, value) => {
            window.electron.store.set(optionKey, value);
        }, 500),
        []
    );

    return (<>
            <div className="flex flex-col min-w-max">
                <ConnectionStatus />
                {toastVisible && (
                    <div className="fixed top-0 left-1/2 transform -translate-x-1/2 p-6">
                        <div className="bg-green-500 text-white text-sm px-3 py-1.5 rounded-md shadow-md">
                            Copied to clipboard
                        </div>
                    </div>
                )}
                <div className="mb-8 p-4 border border-gray-300 rounded-md">
                    <h2 className="text-xl font-semibold mb-4">Overlay</h2>
                    {['Local', 'Remote'].map((label, index) => (
                        <div key={index} className="mb-4">
                            <h2 className="text-sm font-semibold mb-2">{label}</h2>
                            <div className="mt-2 flex rounded-md shadow-sm max-w-md mx-auto">
                                <div className="relative flex flex-grow items-stretch focus-within:z-10">
                                    <input
                                        ref={index === 0 ? localOverlayRef : remoteOverlayRef}
                                        type="text"
                                        name={label}
                                        id={label}
                                        value={index === 0 ? localOverlay : remoteOverlay}
                                        onChange={(e) => {
                                            if (index === 0) {
                                                setLocalOverlay(e.target.value);
                                            } else if (index === 1) {
                                                setRemoteOverlay(e.target.value);
                                            }
                                            handleInputChange(
                                                index === 0 ? 'localOverlay' : 'remoteOverlay',
                                                e.target.value
                                            );
                                        }}
                                        className="block flex-grow rounded-none rounded-l-md border-0 py-1.5 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                                        placeholder={label}
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={() =>
                                        copyToClipboard(
                                            index === 0 ? localOverlayRef : remoteOverlayRef,
                                            label,
                                            index === 0 ? 'localOverlay' : 'remoteOverlay'
                                        )
                                    }
                                    className="relative -ml-px inline-flex items-center gap-x-1.5 rounded-r-md px-3 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                                >Copy
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="mb-4 p-4 border border-gray-300 rounded-md">
                <h2 className="text-xl font-semibold mb-4">Album Art</h2>
                {['Local', 'Remote'].map((label, index) => (
                    <div key={index} className="mb-4">
                    <h2 className="text-sm font-semibold mb-2">{label}</h2>
                    <div className="mt-2 flex rounded-md shadow-sm max-w-md mx-auto">
                        <div className="relative flex flex-grow items-stretch focus-within:z-10">
                            <input
                                ref={index === 0 ? localAlbumArtRef : remoteAlbumArtRef}
                                type="text"
                                name={label}
                                id={label}
                                value={index === 0 ? localAlbumArt : remoteAlbumArt}
                                onChange={(e) => {
                                    if (index === 0) {
                                        setLocalAlbumArt(e.target.value);
                                    } else if (index === 1) {
                                        setRemoteAlbumArt(e.target.value);
                                    } 
                                    handleInputChange(
                                        index === 0 ? 'localAlbumArt' : 'remoteAlbumArt',
                                        e.target.value
                                    );
                                }}
                                className="block flex-grow rounded-none rounded-l-md border-0 py-1.5 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                                placeholder={label}
                            />
                        </div>
                        <button
                            type="button"
                            onClick={() =>
                                copyToClipboard(
                                    index === 0 ? localAlbumArtRef : remoteAlbumArtRef,
                                    label,
                                    index === 0 ? 'localAlbumArt' : 'remoteAlbumArt'
                                )
                            }
                            className="relative -ml-px inline-flex items-center gap-x-1.5 rounded-r-md px-3 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                        >Copy
                        </button>
                    </div>
                </div>
                ))}
                </div>
            </div>
        </>
    );
}