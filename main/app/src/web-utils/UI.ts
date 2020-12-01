import * as $ from "jquery";

export interface AnimationOptions {
    duration: number;
    easing?: (x: number) => number;
    interpolation?: {
        from: number;
        to: number;
    };
    onProgress?: (value: number, percentage: number, easing: number) => void
    onEnd?: (value: number) => void
}

export enum KEY_CODES {
    backspace = 8,
    tab = 9,
    enter = 13,
    shift = 16,
    ctrl = 17,
    alt = 18,
    pauseBreak = 19,
    capsLock = 20,
    escape = 27,
    pageUp = 33,
    pageDown = 34,
    end = 35,
    home = 36,
    leftArrow = 37,
    upArrow = 38,
    rightArrow = 39,
    downArrow = 40,
    insert = 45,
    delete = 46,
    key0 = 48,
    key1 = 49,
    key2 = 50,
    key3 = 51,
    key4 = 52,
    key5 = 53,
    key6 = 54,
    key7 = 55,
    key8 = 56,
    key9 = 57,
    a = 65,
    b = 66,
    c = 67,
    d = 68,
    e = 69,
    f = 70,
    g = 71,
    h = 72,
    i = 73,
    j = 74,
    k = 75,
    l = 76,
    m = 77,
    n = 78,
    o = 79,
    p = 80,
    q = 81,
    r = 82,
    s = 83,
    t = 84,
    u = 85,
    v = 86,
    w = 87,
    x = 88,
    y = 89,
    z = 90,
    command = 91,
    leftWindowKey = 91,
    rightWindowKey = 92,
    selectKey = 93,
    numpad0 = 96,
    numpad1 = 97,
    numpad2 = 98,
    numpad3 = 99,
    numpad4 = 100,
    numpad5 = 101,
    numpad6 = 102,
    numpad7 = 103,
    numpad8 = 104,
    numpad9 = 105,
    multiply = 106,
    add = 107,
    subtract = 109,
    decimalPoint = 110,
    divide = 111,
    f1 = 112,
    f2 = 113,
    f3 = 114,
    f4 = 115,
    f5 = 116,
    f6 = 117,
    f7 = 118,
    f8 = 119,
    f9 = 120,
    f10 = 121,
    f11 = 122,
    f12 = 123,
    numLock = 144,
    scrollLock = 145,
    semicolon = 186,
    equalSign = 187,
    comma = 188,
    dash = 189,
    period = 190,
    forwardSlash = 191,
    graveAccent = 192,
    openBracket = 219,
    backSlash = 220,
    closeBraket = 221,
    singleQuote = 222
}

export class UI {
    
    static preventBackspace(): void {
        $(document).on("keydown", event => {
            if (event.keyCode === 8) {
                let input = <HTMLInputElement><any>event.target;
                if (!$(input).is(":input") && !input.isContentEditable) {
                    event.preventDefault();
                }
            }
        });
    }
    
    static getSelectionText(): string {
        let text = "";
        if (window.getSelection) {
            text = window.getSelection().toString();
        }
        else if ((<any>document).selection && (<any>document).selection.type != "Control") {
            text = (<any>document).selection.createRange().text;
        }
        return text;
    }
    
    static stickyScroll($scrollable: JQuery, $cnt: JQuery, $ele: JQuery, topOffset?: number, min?: number): () => void {
        topOffset = topOffset || 0;
        min = min || 0;
        let callback = () => {
            let po = $scrollable ? $scrollable.offset() : {top: $(window).scrollTop()};
            let co = $cnt.offset();
            po.top += topOffset;
            if (co.top < po.top) {
                if (co.top + $cnt.outerHeight() - min > po.top) {
                    $ele.css("top", (po.top - co.top) + "px");
                }
                else {
                    $ele.css("top", ($cnt.outerHeight() - min) + "px");
                }
            }
            else {
                $ele.css("top", "0px");
            }
        };
        ($scrollable || $(window)).on("scroll", callback);
        return callback;
    }
    
    static animate(options: AnimationOptions) {
        let from = options.interpolation ? options.interpolation.from : 0;
        let to = options.interpolation ? options.interpolation.to : 1;
        let diff = to - from;
        let easing = options.easing || ((x: number) => x);
        let start: number;
        let step = (timestamp: number) => {
            if (!start) {
                start = timestamp;
            }
            let elapsed = timestamp - start;
            let finish = elapsed >= options.duration;
            let percentage = finish ? 1 : elapsed / options.duration;
            let easingValue = easing(percentage);
            let value = from + diff * easingValue;
            if (options.onProgress) {
                options.onProgress(value, percentage, easingValue);
            }
            if (finish) {
                if (options.onEnd) {
                    options.onEnd(value);
                }
            }
            else {
                window.requestAnimationFrame(step);
            }
        }
        window.requestAnimationFrame(step);
    }
    
    static faIconLoading($faIcon: JQuery, minDuration: number = 500): () => void {
        let startTime = new Date().getTime();
        let oldClass = $faIcon.attr("class");
        $faIcon.attr("class", "fa fa-circle-o-notch fa-spin");
        return () => {
            let currTime = new Date().getTime();
            let leftTime = minDuration - (currTime - startTime);
            if (leftTime <= 0) {
                $faIcon.attr("class", oldClass);
            }
            else {
                setTimeout(() => {
                    $faIcon.attr("class", oldClass);
                }, leftTime);
            }
        };
    }
    
    static btnLoading($btn: JQuery, loadingLabel: string, callback?: () => void, minDuration: number = 500): () => void {
        let startTime = new Date().getTime();
        let $faIcon = $btn.find("i");
        let $label = $btn.find("span");
        let oldClass = $faIcon.attr("class");
        let oldLabel = $label.text();
        $faIcon.attr("class", "fa fa-circle-o-notch fa-spin");
        $label.text(loadingLabel);
        return () => {
            let currTime = new Date().getTime();
            let leftTime = minDuration - (currTime - startTime);
            if (leftTime <= 0) {
                $faIcon.attr("class", oldClass);
                $label.text(oldLabel);
                if (callback) {
                    callback();
                }
            }
            else {
                setTimeout(() => {
                    $faIcon.attr("class", oldClass);
                    $label.text(oldLabel);
                    if (callback) {
                        callback();
                    }
                }, leftTime);
            }
        };
    }
    
    static scrollViewIfNeeded(parent: HTMLElement, ele: HTMLElement) {
        let parentBB = parent.getBoundingClientRect();
        let eleBB = ele.getBoundingClientRect();
        if (eleBB.top < parentBB.top) {
            parent.scrollTop += eleBB.top - parentBB.top;
        }
        else if (eleBB.bottom > parentBB.bottom) {
            parent.scrollTop += eleBB.bottom - parentBB.bottom;
        }
    }
    
    static scrollViewIfNeededZ($elem: JQuery<HTMLElement>, up: boolean) {
        let H = $elem.offsetParent().height();
        let t = $elem[0].getBoundingClientRect().top;
        let p = $elem.position().top;
        let elemOffset = $elem.outerHeight() + Math.max(parseFloat($elem.css("margin-bottom")),  parseFloat($elem.css("margin-top")));
        
        if (up === false && t >= H) {
            $elem.offsetParent().scrollTop($elem.offsetParent().scrollTop() + elemOffset );
        }
        else if (up === true && p - elemOffset <= 0) {
            $elem.offsetParent().scrollTop($elem.offsetParent().scrollTop() - elemOffset );
        }
    }
    
    static fadingDiv($container: JQuery, $div: JQuery, initiallyVisible: boolean) {
        if (!initiallyVisible) {
            $div.addClass("hide");
        }
        let mousePosX = 0;
        let mousePosY = 0;
        let savedPosX = 0;
        let savedPosY = 0;
        let overlayVisibilityTimer: NodeJS.Timer;
        let showButtonsOverlay = () => {
            let opacity = "0";
            if ($div.hasClass("fading-out")) {
                opacity = $div.css("opacity") || "0";
                $div.stop(true, true);
            }
            if ($div.hasClass("hide")) {
                $div.css("display", "block").css("opacity", opacity).removeClass("hide").animate({opacity: 1}, 500);
                savedPosX = mousePosX;
                savedPosY = mousePosY;
                setOverlayVisibilityTimer();
            }
        }
        let hideButtonsOverlay = (): void => {
            $div.addClass("fading-out").fadeOut(1000, () => {
                $div.removeClass("fading-out").addClass("hide");
            });
        }
        let isMouseMoved = (): boolean => {
            return (Math.abs(savedPosX - mousePosX) > 5 || Math.abs(savedPosY - mousePosY) > 5);
        }
        let setMousePos = (e: JQuery.Event) => {
            mousePosX = e.clientX;
            mousePosY = e.clientY;
            if (isMouseMoved()) {
                setOverlayVisibilityTimer();
                showButtonsOverlay();
            }
        }
        let setOverlayVisibilityTimer = (): void => {
            if (overlayVisibilityTimer) {
                clearTimeout(overlayVisibilityTimer);
            }
            overlayVisibilityTimer = setTimeout(() => {
                if (isMouseMoved()) {
                    hideButtonsOverlay();
                }
            }, 2000);
        }
        $container.on("mouseenter", showButtonsOverlay);
        $container.on("mouseleave", hideButtonsOverlay);
        $container.on("mousemove", setMousePos);
    }
}
