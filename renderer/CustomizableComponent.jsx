import React, { useContext } from "react";
import { Menu, Transition } from "@headlessui/react";
import { Fragment } from "react";
import { HexColorPicker } from "react-colorful";
import ColorContext from "./ColorContext";
import withClientSideRendering from "./withClientSideRendering";

const ClientSideTransition = withClientSideRendering(Transition);

const CustomizableComponent = ({
    customizableParts,
    onColorChange,
}) => {
    const { colors, setColor, defaultColors } = useContext(ColorContext);
    const mergedColors = { ...defaultColors, ...colors };

    const handleColorChange = (partKey, color) => {
        setColor(partKey, color === "transparent" ? "transparent" : color);
        if (onColorChange) {
            onColorChange(partKey, color === "transparent" ? "transparent" : color);
        }
    };

    return (
        <div>
            <h2 className="text-lg font-bold mb-2">Colors</h2>
            <div className="border p-4 rounded">
                <ul
                    role="list"
                    className="grid grid-rows-5 gap-4"
                >
                    {customizableParts.map((part) => (
                        <li key={part.key} className="flex items-center">
                            <span style={{ marginTop: '-0.4rem' }}
                                className="mr-2 text-sm font-bold text-gray-800 align-middle">
                                {part.label}
                            </span>
                            <Menu as="div" className="relative inline-block text-left">
                                <Menu.Button
                                    className="w-5 h-5 rounded cursor-pointer mb-2 focus:outline-none">
                                    <div
                                        className="h-1/2 border border-black rounded-sm"
                                        style={{ backgroundColor: mergedColors[part.key] || "#000000" }}
                                    />
                                </Menu.Button>
                                <ClientSideTransition
                                    as={Fragment}
                                    enter="transition ease-out duration-100"
                                    enterFrom="transform opacity-0 scale-95"
                                    enterTo="transform opacity-100 scale-100"
                                    leave="transition ease-in duration-75"
                                    leaveFrom="transform opacity-
                                100 scale-100"
                                    leaveTo="transform opacity-0 scale-95"
                                >
                                    <Menu.Items
                                        className="absolute z-50 w-24">
                                        <div>
                                            <HexColorPicker
                                                color={mergedColors[part.key] || "#000000"}
                                                onChange={(color) => handleColorChange(part.key, color)}
                                            />
                                        </div>
                                    </Menu.Items>
                                </ClientSideTransition>
                            </Menu>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

export default CustomizableComponent;
