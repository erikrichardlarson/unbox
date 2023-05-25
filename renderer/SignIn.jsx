import React, {useContext, useEffect, useState} from "react";
import { CheckIcon } from '@heroicons/react/solid'
import {UserContext} from "./UserContext";
import logo from "../logo.png";

const includedFeatures = [
    'Real-time Metadata API Integration: Unbox gathers precise track metadata including album artwork once your track is loaded. Leveraging trusted external sources, this fills in any missing metadata and cleans up any inconsistencies.',
    'Follow the Master Channel: Exclusive to Unbox Plus, we only unveil tracks to your listeners when your listeners hear the track. This currently works with Traktor, Serato, and VirtualDJ.',
    'Personalized Recommendations: Let Unbox help you with your next mix, we recommend up to 500 tracks for your next mix, curated specifically based on your historical tracklist preferences.',
    'Automatic Updates: Be the first to get our latest feature additions.'
]

const Spinner = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-t-2 border-b-2 border-indigo-500 rounded-full"></div>
    </div>
);



function Subscribe() {

    const { handleLogout } = useContext(UserContext);

    const handleSubscription = (event) => {
        event.preventDefault();
        userbase.purchaseSubscription({
            successUrl: 'https://github.com/erikrichardlarson/unbox',
            cancelUrl: 'https://github.com/erikrichardlarson/unbox',
            priceId: 'price_1J8BeeA3OaUfbwuDsFOd2Xf8'
        }).then(() => {
            alert('Subscription purchased!');
            handleLogout();
        }).catch((e) => console.error(e));
    }

    return (
        <div className="bg-white">
            <div className="mx-auto max-w-3xl px-6 lg:px-8">
                <div className="mx-auto mt-4 max-w-2xl rounded-3xl ring-1 ring-indigo-600 lg:mx-0 lg:flex lg:max-w-none">
                    <div className="px-6 py-4 lg:flex-auto mb-2">
                        <div className="rounded-2xl text-center lg:flex lg:flex-col lg:justify-center lg:py-4">
                            <div className="mx-auto max-w-xs px-8">
                                <img src={logo} alt="Unbox Logo" className="mx-auto h-16 w-16"/>
                                <p className="mt-6 flex items-baseline justify-center gap-x-2">
                                    <span className="text-5xl font-bold tracking-tight text-gray-900">$3.99</span>
                                    <span className="text-sm font-semibold leading-6 tracking-wide text-gray-600">/month</span>
                                </p>
                                <a
                                    href="#"
                                    className="mt-2 block w-3/4 mx-auto rounded-md bg-indigo-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                                    onClick={handleSubscription}
                                >
                                    Subscribe
                                </a>
                            </div>
                        </div>
                        <div className="mt-2 flex items-center gap-x-4">
                            <h4 className="flex-none text-sm font-semibold leading-6 text-indigo-600">Subscribe to Unbox Plus to get these features</h4>
                            <div className="h-px flex-auto bg-indigo-600" />
                        </div>
                        <ul
                            role="list"
                            className="mt-4 grid grid-cols-1 gap-4 text-sm leading-6 text-black sm:grid-cols-1 sm:gap-6"
                        >
                            {includedFeatures.map((feature) => (
                                <li key={feature} className="flex gap-x-3">
                                    <CheckIcon className="h-6 w-5 flex-none text-indigo-600" aria-hidden="true" />
                                    <p className="font-semibold">{feature}</p>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    )
}


function LoginSignup() {
    const { user, setUser, subscriptionStatus, setSubscriptionStatus } = useContext(UserContext);
    const [showRegister, setShowRegister] = useState(false);
    const [shouldSpin, setShowSpinner] = useState(false);

    const showSpinner = () => {
        setShowSpinner(true);
    };

    const hideSpinner = () => {
        setShowSpinner(false);
    };

    useEffect(() => {
        userbase
            .init({ appId: '01e86fc7-a250-4955-9f43-6c9df9bb0b6d' })
            .then((session) => session.user && setUser(session.user));
    }, []);

    const [regForm, setRegForm] = useState({ username: "", password: "" });
    const [loginForm, setLoginForm] = useState({ username: "", password: "" });
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 3;

    const recommendedTracks = window.electron.store.get('recommendedTracks') || [];
    const flattenedTracks = recommendedTracks.reduce((acc, curr) => curr.tracks ? [...acc, ...curr.tracks] : acc, []);
    const totalItems = flattenedTracks.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentItems = flattenedTracks.slice(startIndex, endIndex);

    const handlePrevious = () => {
        setCurrentPage(Math.max(1, currentPage - 1));
    };

    const handleNext = () => {
        setCurrentPage(Math.min(totalPages, currentPage + 1));
    };

    const handleRegInputChange = (event) =>
        setRegForm({ ...regForm, [event.target.name]: event.target.value });

    const handleLoginInputChange = (event) =>
        setLoginForm({ ...loginForm, [event.target.name]: event.target.value });

    const handleRegSubmit = (event) => {
        event.preventDefault();
        if (regForm.username && regForm.password) {
            showSpinner();
            userbase
                .signUp({
                    username: regForm.username,
                    password: regForm.password,
                    rememberMe: "none",
                })
                .then((ur) => {
                    setUser(ur);
                    hideSpinner();
                })
                .catch((err) => {
                    alert(err);
                    hideSpinner();
                });
        }
    };

    const handleLoginSubmit = (event) => {
        event.preventDefault();
        if (loginForm.username && loginForm.password) {
            showSpinner();
            userbase
                .signIn({
                    username: loginForm.username,
                    password: loginForm.password,
                    rememberMe: "none",
                })
                .then((ur) => {
                    setUser(ur);
                    if (ur.subscriptionStatus === 'active') {
                        window.electron.store.set('authToken', ur.authToken);
                    }
                    setSubscriptionStatus(ur.subscriptionStatus);
                    hideSpinner();
                })
                .catch((err) => {
                    alert(err);
                    hideSpinner();
                });
        }
    };

    const toggleForm = () => {
        showSpinner();
        setTimeout(() => {
            hideSpinner();
            setShowRegister(!showRegister);
        }, 300);
    };

    return (
        <div className="bg-white flex flex-col justify-center">
            {shouldSpin ? <Spinner /> : user ? (
                    <div className="flex flex-col items-center justify-between w-full mx-auto">
                        {subscriptionStatus !== 'active' && (
                            <>
                            <Subscribe />
                            </>
                            )}
                        {(
                            subscriptionStatus === 'active' && (
                                <div className="banner">
                                    <div className="flex flex-col items-center justify-center">
                                        <h1 className="text-2xl font-bold text-center text-black mb-2">Recommended Tracks</h1>
                                        <ul role="list" className="space-y-6">
                                            {currentItems.map((track, index) => (
                                                <li key={index} className="overflow-hidden bg-gray-300 px-4 py-4 shadow sm:rounded-md sm:px-6">
                                                    <h2 className="text-black uppercase font-black text-base">
                                                        {Array.isArray(track.artist) ? track.artist.join(', ') : track.artist}
                                                    </h2>
                                                    <h1 className="text-black uppercase font-black text-base">{track.track}</h1>
                                                    <h2 className="text-black uppercase font-black text-sm">({track.remix})</h2>
                                                    <h2 className="text-black uppercase font-black text-sm italic">[{track.label}]</h2>
                                                </li>
                                            ))}
                                        </ul>
                                        <nav
                                            className="flex flex-col items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6 mt-4"
                                            aria-label="Pagination"
                                        >
                                            <div className="mb-2">
                                                <p className="text-sm text-gray-700">
                                                    Showing <span className="font-medium">{startIndex + 1}</span> to{' '}
                                                    <span className="font-medium">{Math.min(endIndex, totalItems)}</span> of{' '}
                                                    <span className="font-medium">{totalItems}</span> results
                                                </p>
                                            </div>
                                            <div className="flex justify-center">
                                                <button
                                                    onClick={handlePrevious}
                                                    className="relative inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus-visible:outline-offset-0"
                                                    disabled={currentPage === 1}
                                                >
                                                    Previous
                                                </button>
                                                <button
                                                    onClick={handleNext}
                                                    className="relative ml-3 inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus-visible:outline-offset-0"
                                                    disabled={currentPage === totalPages}
                                                >
                                                    Next
                                                </button>
                                            </div>
                                        </nav>

                                    </div>
                                </div>
                            )
                        )}
                    </div>
                ) : (
                    <div className="flex-1">
                        {showRegister ? (
                            <>
                                <div className="mt-5 sm:mx-auto sm:w-full sm:max-w-md">
                                    <h2 className="text-center text-2xl font-bold leading-9 tracking-tight text-gray-900">
                                        Register to access Unbox Plus
                                    </h2>
                                    <form className="space-y-6 mt-5" onSubmit={handleRegSubmit}>
                                        <div>
                                            <label
                                                htmlFor="username"
                                                className="block text-sm font-medium leading-6 text-gray-900"
                                            >
                                                Username
                                            </label>
                                            <div className="mt-2">
                                                <input
                                                    id="username"
                                                    name="username"
                                                    type="text"
                                                    autoComplete="username"
                                                    required
                                                    value={regForm.username}
                                                    onChange={handleRegInputChange}
                                                    className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label
                                                htmlFor="password"
                                                className="block text-sm font-medium leading-6 text-gray-900"
                                            >
                                                Password
                                            </label>
                                            <div className="mt-2">
                                                <input
                                                    id="password"
                                                    name="password"
                                                    type="password"
                                                    autoComplete="new-password"
                                                    required
                                                    value={regForm.password}
                                                    onChange={handleRegInputChange}
                                                    className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <button
                                                type="submit"
                                                className="flex w-full justify-center items-center px-4 py-2 border text-sm font-medium rounded-md border-gray-300 bg-gray-100 p-6 shadow-sm hover:border-gray-400 hover:bg-gray-900 hover:text-white text-gray-900"
                                            >
                                                Register
                                            </button>
                                        </div>
                                    </form>
                                </div>
                                <div className="mt-10 text-center text-sm text-gray-500">
                                    Already subscribed?{" "}
                                    <button
                                        onClick={toggleForm}
                                        className="font-semibold leading-6 text-indigo-600 hover:text-indigo-500 focus:outline-none"
                                    >
                                        Log in
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="mt-5 sm:mx-auto sm:w-full sm:max-w-md">
                                    <h2 className="text-center text-2xl font-bold leading-9 tracking-tight text-gray-900">
                                        Login to access Unbox Plus
                                    </h2>
                                    <form className="space-y-6 mt-5" onSubmit={handleLoginSubmit}>
                                        <div>
                                            <label
                                                htmlFor="username-login"
                                                className="block text-sm font-medium leading-6 text-gray-900"
                                            >
                                                Username
                                            </label>
                                            <div className="mt-2">
                                                <input
                                                    id="username-login"
                                                    name="username"
                                                    type="text"
                                                    autoComplete="username"
                                                    required
                                                    value={loginForm.username}
                                                    onChange={handleLoginInputChange}
                                                    className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label
                                                htmlFor="password-login"
                                                className="block text-sm font-medium leading-6 text-gray-900"
                                            >
                                                Password
                                            </label>
                                            <div className="mt-2">
                                                <input
                                                    id="password-login"
                                                    name="password"
                                                    type="password"
                                                    autoComplete="current-password"
                                                    required
                                                    value={loginForm.password}
                                                    onChange={handleLoginInputChange}
                                                    className="block w-full rounded-md border-0 py-1.5 text                         gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <button
                                                type="submit"
                                                className="flex w-full justify-center items-center px-4 py-2 border text-sm font-medium rounded-md border-gray-300 bg-gray-100 p-6 shadow-sm hover:border-gray-400 hover:bg-gray-900 hover:text-white text-gray-900"
                                            >
                                                Log in
                                            </button>
                                        </div>
                                    </form>
                                </div>
                                <div className="mt-10 text-center text-sm text-gray-500">
                                    Not signed up yet?{" "}
                                    <button
                                        onClick={toggleForm}
                                        className="font-semibold leading-6 text-indigo-600 hover:text-indigo-500 focus:outline-none"
                                    >
                                        Sign up
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                )}
        </div>
    );
}

export default LoginSignup;


