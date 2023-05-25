import React, {useContext, useState} from "react";
import Stepper from "./Stepper";
import {IDProvider} from "./IDContext";
import ConnectedContext from './ConnectedContext';
import {UserContext} from "./UserContext";
import logo from '../logo.png';

const App = () => {
    const [currentStep, setCurrentStep] = useState(0);
    const [connected, setConnected] = useState(false);
    const { user, setUser, handleLogout } = useContext(UserContext);

    return (
        <div className="w-full h-screen flex flex-col items-start justify-start p-4 bg-white">
            <div className="w-full flex justify-between items-center mb-4">
                <div className="flex items-center">
                    <img src={logo} alt="Unbox Logo" className="h-8 w-8 mr-2"/>
                    <h1 className="text-2xl font-black text-left">unbox</h1>
                </div>
                {user &&
                    <button
                        onClick={handleLogout}
                        className="rounded-full bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
                    >
                        Logout
                    </button>
                }
            </div>
            <div className="w-full mx-auto px-4 sm:px-6 lg:px-8">
                <div className="w-full">
                    <ConnectedContext.Provider value={{ connected, setConnected }}>
                    <IDProvider>
                        <Stepper currentStep={currentStep} setCurrentStep={setCurrentStep} />
                    </IDProvider>
                    </ConnectedContext.Provider>
                </div>
            </div>
        </div>
    );
};

export default App;
