import React, { useContext, useEffect, useState, Fragment } from "react";
import { Transition } from "@headlessui/react";
import ModeContext from "./ModeContext";
import ConnectedContext from "./ConnectedContext";

const modes = [
    { name: "Rekordbox" },
    { name: "Serato" },
    { name: "Traktor" },
    { name: "Prolink" },
    { name: "VirtualDJ" },
    { name: "Mixxx" },
    { name: "DJUCED" },
];

const ModeSelector = () => {
    const { selectedMode, setSelectedMode } = useContext(ModeContext);
    const [seratoUserId, setSeratoUserId] = useState(window.electron.store.get("seratoUserId") || "");
    const { connected, setConnected } = useContext(ConnectedContext);


    useEffect(() => {
        if (selectedMode === "Serato") {
            const storedUserId = window.electron.store.get("seratoUserId");
            if (storedUserId) {
                setSeratoUserId(storedUserId);
            }
        }
    }, [selectedMode]);

    const [showNotification, setShowNotification] = useState(false);

    const handleInputChange = (event) => {
        setSeratoUserId(event.target.value);
    };

    const handleSaveButtonClick = () => {
        window.electron.store.set("seratoUserId", seratoUserId);
        setShowNotification(true);
        setTimeout(() => setShowNotification(false), 3000);
    };


    const handleGridClick = (mode) => {
        setConnected(false);
        setSelectedMode(mode);
        window.electron.store.set("mode", mode);
    };

    return (
        <>
            <div
                aria-live="assertive"
                className="pointer-events-none fixed inset-0 flex items-end px-4 py-6 sm:items-start sm:p-6"
            >
                <div className="flex w-full flex-col items-center space-y-4 sm:items-end">
                    <Transition
                        show={showNotification}
                        as={Fragment}
                        enter="transform ease-out duration-300 transition"
                        enterFrom="translate-y-2 opacity-0 sm:translate-y-0 sm:translate-x-2"
                        enterTo="translate-y-0 opacity-100 sm:translate-x-0"
                        leave="transition ease-in duration-100"
                        leaveFrom="opacity-100"
                        leaveTo="opacity-0"
                    >
                        <div className="pointer-events-auto w-full max-w-sm overflow-hidden rounded-lg bg-white shadow-lg ring-1 ring-black ring-opacity-5">
                            <div className="p-4">
                                <div className="flex items-start">
                                    <div className="ml-3 w-0 flex-1 pt-0.5">
                                        <p className="text-sm font-bold text-green-600">Successfully saved</p>
                                        <p className="mt-1 text-sm text-gray-800">
                                            {seratoUserId} has been saved as the Serato User ID
                                        </p>
                                    </div>
                                    <div className="ml-4 flex flex-shrink-0">
                                        <button
                                            type="button"
                                            className="inline-flex rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                                            onClick={() => {
                                                setShowNotification(false);
                                            }}
                                        >
                                            <span className="sr-only">Close</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Transition>
                </div>
            </div>
        <div className="h-full flex flex-col justify-center items-center w-1/2">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 w-full">
                {modes.map((mode) => (
                    <div
                        key={mode.name}
                        className={`relative flex items-center justify-center rounded-lg cursor-pointer ${
                            selectedMode === mode.name
                                ? "border border-gray-900 bg-gray-900"
                                : "border border-gray-300 bg-gray-100"
                        } p-6 shadow-sm hover:border-gray-400`}
                        onClick={() => handleGridClick(mode.name)}
                    >
                        <p
                            className={`text-lg font-black focus:outline-none ${
                                selectedMode === mode.name ? "text-white" : "text-gray-900"
                            }`}
                        >
                            {mode.name}
                        </p>
                    </div>
                ))}
            </div>
            <div>
                {selectedMode === "Serato" && (
                    <div className="mt-12 w-full flex justify-center">
                        <div className="flex items-center space-x-4">
                            <div className="rounded-md px-3 pb-1.5 pt-2.5 shadow-sm ring-1 ring-inset ring-gray-300 focus-within:ring-2 focus-within:ring-indigo-600">
                                <input
                                    type="text"
                                    id="seratoUserId"
                                    value={seratoUserId}
                                    className="block w-full border-0 p-0 text-gray-900 placeholder:text-gray-400 focus:ring-0 sm:text-sm sm:leading-6"
                                    onChange={handleInputChange}
                                    placeholder="Enter Serato User ID"
                                />
                            </div>
                            <button
                                type="button"
                                className="inline-flex items-center px-4 py-2 border text-sm font-medium rounded-md border-gray-300 bg-gray-100 p-6 shadow-sm hover:border-gray-400 hover:bg-gray-900 hover:text-white text-gray-900"
                                onClick={handleSaveButtonClick}
                            >
                                Save User ID
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
        </>
    );
};

export default ModeSelector;
