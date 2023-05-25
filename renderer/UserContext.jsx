import React, { useState, createContext } from "react";

export const UserContext = createContext();

export const UserProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [subscriptionStatus, setSubscriptionStatus] = useState('inactive');

    const handleLogout = () => {
        userbase
            .signOut()
            .then(() => {
                window.electron.store.set('authToken', '');
                setUser(undefined);
            })
            .catch((err) => {
                alert(err);
            });
    };

    return (
        <UserContext.Provider value={{ user, setUser, handleLogout, subscriptionStatus, setSubscriptionStatus }}>
            {children}
        </UserContext.Provider>
    );
};