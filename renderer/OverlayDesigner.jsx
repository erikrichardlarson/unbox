import React, {useCallback, useEffect, useState} from "react";
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import ASOT from "./ASOT";
import {ColorProvider} from "./ColorContext";
import CustomizableComponent from "./CustomizableComponent";
import withClientSideRendering from "./withClientSideRendering";
import {debounce} from "lodash";
import {IDProvider} from "./IDContext";
import {setupWebSocket} from "./websocketHandler";
import {htmlTemplate} from "./overlayTemplate";
import {style} from "./overlayStyle";
import OverlayDropdown from "./OverlayDropdown";

const CustomizableComponentWithCSR = withClientSideRendering(
    CustomizableComponent
);

const OverlayDesigner = () => {
    const customizableParts = {
        'ASOT': [{key: "backgroundColor", label: "Background Color"},
            {key: "nowPlaying", label: "Now Playing Color"},
            {key: "artist", label: "Artist Color"},
            {key: "title", label: "Title Color"},
            {key: "label", label: "Label Color"},
        ]
    };

    const options = [
        {id: 1, name: "ASOT"},
    ];

    const [selectedOption, setSelectedOption] = useState(
        window.electron.store.get("overlay") || options[0]
    );

    useEffect(() => {
        exportToHTML();
    }, [selectedOption.id]);

    const handleColorChange = () => {
        handleColorChangeDebounced();
    };

    const getComponentByName = (name) => {
        switch (name) {
            case "ASOT":
                return ASOT;
            default:
                return ASOT;
        }
    };

    const handleColorChangeDebounced = useCallback(
        debounce(() => {
            exportToHTML();
        }, 500),
        []
    );

    const [SelectedComponent, setSelectedComponent] = useState(
        getComponentByName(selectedOption.name)
    );

    const handleOptionChange = (option) => {
        setSelectedOption(option);
        setSelectedComponent(getComponentByName(option.name));
        window.electron.store.set("overlay", option);
        exportToHTML();
    };

    const exportToHTML = () => {
        const ComponentToRender = getComponentByName(selectedOption.name);
        const div = document.createElement('div');
        const root = createRoot(div);
        flushSync(() => {
            root.render(<IDProvider>
                <ColorProvider>
                    <div className="relative w-full h-full">
                        <ComponentToRender />
                    </div>
                </ColorProvider>
            </IDProvider>);
        });
        const htmlString = div.innerHTML;
        if (htmlString === "") {
            return;
        }
        const itemsASOT = [
            {id: 1, contentType: 'NOW PLAYING', selector: '.sweep-text-now-playing'},
            {id: 2, contentType: 'Artist', selector: '.sweep-text-artist'},
            {id: 3, contentType: 'Title', selector: '.sweep-text-title'},
            {id: 4, contentType: 'Label', selector: '.sweep-text-label'},
        ];

        const scriptTag = `<script>
                            document.addEventListener('DOMContentLoaded', () => {
                              const items = ${JSON.stringify(itemsASOT)};
                              items.forEach(item => {
                                item.element = document.querySelector(item.selector);
                              });
                              ${setupWebSocket}
                              setupWebSocket(items);
                            });
                            </script>`;

        const html = htmlTemplate(scriptTag, style, htmlString);
        window.electron.send("export-overlay", html);
        window.electron.send("export-overlay", html);
    };

    return (
        <div className="w-full h-full">
            <div className="flex flex-col justify-center items-center mb-10 space-y-4">
                <div className="relative flex justify-center items-center w-full px-4">
                    <OverlayDropdown
                        options={options}
                        onChange={handleOptionChange}
                        selectedOption={selectedOption}
                    />
                </div>
                <div
                    style={{
                        width: "100%",
                        height: "100%",
                        position: "relative",
                    }}
                    className="bg-gray-300 rounded-lg p-6 shadow-2xl"
                >
                    <ColorProvider>
                        <CustomizableComponentWithCSR
                            component={getComponentByName(selectedOption.name)}
                            customizableParts={customizableParts[selectedOption.name]}
                            onColorChange={handleColorChange}
                        />
                    </ColorProvider>
                </div>
            </div>
        </div>
    );

};

export {OverlayDesigner};
