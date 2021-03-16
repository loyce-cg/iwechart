interface Size {
    width: number;
    height: number;
}

interface Position {
    left: number;
    top: number;
}

type Rect = Size & Position;

interface Range {
    start: number;
    end: number;
}

export enum PopupPlacement {
    BEFORE = "before",
    COMMON_START = "common-start",
    COMMON_END = "common-end",
    AFTER = "after",
}

export class PopupPositionCalculator {
    
    static readonly POPUP_TO_WINDOW_CLEARANCE: number = 10;
    
    static calculatePosition($popup: JQuery, $target: JQuery, horizontalPlacement: PopupPlacement, verticalPlacement: PopupPlacement): Position {
        const windowSize: Size = this._getWindowSize();
        const popupSize: Size = this._getPopupSize($popup);
        const targetRect: Rect = this._getTargetRect($target);
        const targetPosition: Position = {
            left: this._calculateSingleDimension(
                popupSize.width,
                <Range>{ start: targetRect.left, end: targetRect.left + targetRect.width },
                windowSize.width,
                horizontalPlacement,
            ),
            top: this._calculateSingleDimension(
                popupSize.height,
                <Range>{ start: targetRect.top, end: targetRect.top + targetRect.height },
                windowSize.height,
                verticalPlacement,
            ),
        };
        return targetPosition;
    }
    
    private static _calculateSingleDimension(popupLength: number, targetRange: Range, windowLength: number, placement: PopupPlacement): number {
        if (popupLength + 2 * PopupPositionCalculator.POPUP_TO_WINDOW_CLEARANCE >= windowLength) {
            return (windowLength - popupLength) / 2;
        }
        let pos: number = 0;
        if (placement == PopupPlacement.BEFORE) {
            pos = targetRange.start - popupLength;
        }
        else if (placement == PopupPlacement.COMMON_START) {
            pos = targetRange.start;
        }
        else if (placement == PopupPlacement.COMMON_END) {
            pos = targetRange.end - popupLength;
        }
        else if (placement == PopupPlacement.AFTER) {
            pos = targetRange.end;
        }
        pos = Math.max(PopupPositionCalculator.POPUP_TO_WINDOW_CLEARANCE, pos);
        if (pos + popupLength > windowLength - PopupPositionCalculator.POPUP_TO_WINDOW_CLEARANCE) {
            pos = (pos + popupLength) - windowLength - PopupPositionCalculator.POPUP_TO_WINDOW_CLEARANCE;
        }
        return pos;
    }
    
    private static _getWindowSize(): Size {
        return {
            width: window.innerWidth,
            height: window.innerHeight,
        };
    }
    
    private static _getPopupSize($popup: JQuery): Size {
        return {
            width: $popup.outerWidth(),
            height: $popup.outerHeight(),
        };
    }
    
    private static _getTargetRect($target: JQuery): Rect {
        const position = $target.offset();
        return {
            left: position.left,
            top: position.top,
            width: $target.outerWidth(),
            height: $target.outerHeight(),
        };
    }
    
}
