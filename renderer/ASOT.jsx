import React, {useContext} from "react";
import "./ASOT.css";
import ColorContext from "./ColorContext";
import IDContext from "./IDContext";

const ASOT = () => {
    const {colors, defaultColors} = useContext(ColorContext);
    const {artist, title, label} = useContext(IDContext);

    const mergedColors = {...defaultColors, ...colors};
    const items = [
        {id: 1, contentType: 'NOW PLAYING'},
        {id: 2, contentType: 'Artist', content: artist},
        {id: 3, contentType: 'Title', content: title},
        {id: 4, contentType: 'Label', content: `[${label}]`},
    ]

    return (
        <React.Fragment key={artist + title}>
            <div className="overflow-hidden rounded-lg max-w-2xl" style={{backgroundColor: "transparent"}}>
                <div className="px-4 py-5 sm:p-6" style={{backgroundColor: "transparent"}}>
                    <div className="mx-auto max-w-fit min-w-fit" style={{backgroundColor: "transparent"}}>
                        <div className="flex items-stretch" style={{backgroundColor: "transparent"}}>
                            <div className="h-full" style={{backgroundColor: "transparent"}}>
                                <div
                                    className="w-full overflow-hidden rounded-s p-6 flex flex-col h-full">
                                    {items.map((item) => {
                                        let className;
                                        let style;
                                        switch (item.contentType) {
                                            case 'NOW PLAYING':
                                                className = "text-6xl font-sans font-black sweep-text-item sweep-text-now-playing";
                                                style = {color: mergedColors.nowPlaying};
                                                return (
                                                    <div key={item.id} className="px-4 sm:px-2 order-2 sweep-text-banner flex items-center justify-center mb-2" style={{backgroundColor: mergedColors.backgroundColor, '--end-bg-color': mergedColors.backgroundColor}}>
                                                        <div className={className} style={style}>
                                                            {item.contentType}
                                                        </div>
                                                    </div>
                                                )
                                            case 'Artist':
                                                className = "text-2xl font-sans font-extrabold mb-1 sweep-text-item sweep-text-artist";
                                                style = {color: mergedColors.artist};
                                                break;
                                            case 'Title':
                                                className = "text-2xl font-sans font-extrabold mb-1 sweep-text-item sweep-text-title";
                                                style = {color: mergedColors.title};
                                                break;
                                            case 'Label':
                                                className = "text-2xl font-sans font-light italic sweep-text-item sweep-text-label";
                                                style = {color: mergedColors.label};
                                                break;
                                            default:
                                                className = "";
                                                style = {};
                                        }

                                        return (
                                            <React.Fragment key={item.id}>
                                                {item.contentType !== 'NOW PLAYING' && item.contentType !== 'Album Art' && (
                                                    <div className="px-4 order-3" >
                                                        <div className={className} style={style}>
                                                            {item.content}
                                                        </div>
                                                    </div>
                                                )}
                                            </React.Fragment>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </React.Fragment>
    );
};

export default ASOT;

