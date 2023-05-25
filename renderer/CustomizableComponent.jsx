import React, {useContext} from "react";
import {Menu, Transition} from "@headlessui/react";
import {Fragment} from "react";
import {HexColorPicker} from "react-colorful";
import ColorContext from "./ColorContext";
import withClientSideRendering from "./withClientSideRendering";

const ClientSideTransition = withClientSideRendering(Transition);

const CustomizableComponent = ({
                                   component: Component,
                                   customizableParts,
                                   onColorChange,
                               }) => {
    const {colors, setColor, defaultColors} = useContext(ColorContext);
    const mergedColors = {...defaultColors, ...colors};

    const handleColorChange = (partKey, color) => {
        setColor(partKey, color === "transparent" ? "transparent" : color);
        if (onColorChange) {
            onColorChange(partKey, color === "transparent" ? "transparent" : color);
        }
    };

    return (
        <div>
            <ul
                role="list"
                className="grid grid-cols-6 gap-4 md:grid-cols-5 lg:grid-cols-5 xl:grid-cols-5"
            >
                {customizableParts.map((part) => (
                    <li key={part.key} className="flex flex-col items-center">
                        <span className="mb-2 inline-flex uppercase items-center rounded-md bg-gray-50 px-2 py-1 text-sm font-bold text-gray-800 ring-1 ring-inset ring-gray-500/10">
        {part.label}
      </span>
                        <Menu as="div" className="relative inline-block text-left">
                            <Menu.Button
                                className="w-5 h-5 rounded cursor-pointer mb-2 focus:outline-none">
                                <div
                                    className="w-full h-full"
                                    style={{backgroundColor: mergedColors[part.key] || "#000000"}}
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
                                    className="absolute z-50 w-56 mt-2 origin-top-left divide-y divide-gray-100 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                                    <div className="p-4">
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
            <div className="overflow-hidden rounded-lg">
                <div className="px-4 py-5 sm:p-6"><Component />
                </div>
            </div>
        </div>
    );
};

export default CustomizableComponent;