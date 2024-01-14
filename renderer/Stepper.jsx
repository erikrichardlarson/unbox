import React, { useState } from "react";
import ModeSelector from "./ModeSelector";
import { OverlayDesigner } from "./OverlayDesigner";
import { ColorProvider } from "./ColorContext";
import GoLive from "./GoLive";
import LoginSignup from "./SignIn";
import ModeContext from './ModeContext';


const Stepper = ({ currentStep, setCurrentStep }) => {
    const [selectedMode, setSelectedMode] = useState(window.electron.store.get('mode'));

    const steps = [
        { label: "Select your mode.", content: <ModeSelector /> },
        { label: "Customize your overlay.", content: <OverlayDesigner /> },
        {label: "Go live.", content: <GoLive />},
        { label: "Unbox Plus", content: <LoginSignup /> },
    ];

    const [isPrevButtonClicked, setIsPrevButtonClicked] = useState(false);
    const [isNextButtonClicked, setIsNextButtonClicked] = useState(false);

    const handlePreviousClick = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    const handleNextClick = () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep(currentStep + 1);
        }
    };

    const handlePrevMouseDown = () => {
        setIsPrevButtonClicked(true);
    };

    const handlePrevMouseUp = () => {
        setIsPrevButtonClicked(false);
    };

    const handleNextMouseDown = () => {
        setIsNextButtonClicked(true);
    };

    const handleNextMouseUp = () => {
        setIsNextButtonClicked(false);
    };

    return (
        <ColorProvider>
            <ModeContext.Provider value={{ selectedMode, setSelectedMode }}>
                <div className="w-full h-full flex flex-col justify-between items-center">
                    <div
                        className="flex justify-between w-10/12 mb-8 fixed top-1/2 left-0 right-0 mx-auto transform -translate-y-1/2"
                        style={{ zIndex: 0 }}>
                        <div>
                            {currentStep !== 0 && (
                                <button
                                    className={`bg-gray-800 text-white p-2 rounded transform transition-all duration-150 ${isPrevButtonClicked ? "scale-90" : ""
                                        }`}
                                    onClick={handlePreviousClick}
                                    onMouseDown={handlePrevMouseDown}
                                    onMouseUp={handlePrevMouseUp}
                                    onMouseLeave={handlePrevMouseUp}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none"
                                        viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                            d="M15 19l-7-7 7-7" />
                                    </svg>
                                </button>
                            )}
                        </div>
                        <div>
                            {currentStep < steps.length - 1 && (
                                <button
                                    className={`bg-gray-800 text-white p-2 rounded transform transition-all duration-150 ${isNextButtonClicked ? "scale-90" : ""
                                        }`}
                                    onClick={handleNextClick}
                                    onMouseDown={handleNextMouseDown}
                                    onMouseUp={handleNextMouseUp}
                                    onMouseLeave={handleNextMouseUp}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none"
                                        viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                            d="M9 5l7 7-7 7" />
                                    </svg>
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="text-3xl font-bold mb-4">{steps[currentStep].label}</div>
                    <div className="text-sm mb-2 text-gray-500 mb-8">
                        {currentStep + 1} / {steps.length}
                    </div>
                    <div style={{ display: 'grid', placeItems: 'center', width: '75%', position: 'relative', zIndex: 10 }}>
                        {steps[currentStep].content}
                    </div>
                </div>
            </ModeContext.Provider>
        </ColorProvider>
    );
};

export default Stepper;