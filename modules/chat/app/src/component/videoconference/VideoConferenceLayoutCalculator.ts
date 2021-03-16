export interface VideoConferenceLayout {
    nColumns: number;
    nRows: number;
}

export interface VideoConferenceLayoutEx extends VideoConferenceLayout {
    personWidth: number;
    personHeight: number;
}

interface LayoutScoreWithDetails {
    score: number;
    personWidth: number;
    personHeight: number;
}

export class VideoConferenceLayoutCalculator {
    
    protected static readonly ASPECT_RATIO = 16 / 9;
    protected static readonly MAX_COLUMNS = 32;
    protected static readonly MAX_ROWS = 18;
    
    // Index is the number of people, value is an array of available layouts
    protected static _cachedLayouts: VideoConferenceLayout[][] = [];
    
    protected static _buildCache(): void {
        if (this._cachedLayouts.length > 0) {
            return;
        }
        
        // Config
        const maxCells = this.MAX_COLUMNS * this.MAX_ROWS;
        
        // Build array of empty arrays
        for (let i = 0; i <= maxCells; ++i) {
            this._cachedLayouts.push([]);
        }
        
        // Build layouts
        for (let nColumns = 1; nColumns <= this.MAX_COLUMNS; ++nColumns) {
            for (let nRows = 1; nRows <= this.MAX_ROWS; ++nRows) {
                let minPeople = Math.max((nColumns - 1) * nRows, nColumns * (nRows - 1)) + 1;
                let maxPeople = nColumns * nRows;
                for (let nPeople = minPeople; nPeople <= maxPeople; ++nPeople) {
                    this._cachedLayouts[nPeople].push({
                        nColumns,
                        nRows,
                    });
                }
            }
        }
    }
    
    protected static _calculateLayoutScoreAndDetails(layout: VideoConferenceLayout, availableWidth: number, availableHeight: number, columnSpacing: number, rowSpacing: number, nPeople: number): LayoutScoreWithDetails {
        // Calculate width/height used for spacing: between two people and between a person and available rect borders
        let widthUsedForSpacing: number = columnSpacing * (layout.nColumns + 1);
        let heightUsedForSpacing: number = rowSpacing * (layout.nRows + 1);
        
        // Calculate width/height available for people
        let realAvailableWidth: number = availableWidth - widthUsedForSpacing;
        let realAvailableHeight: number = availableHeight - heightUsedForSpacing;
        
        // Calculate width/height available to a single person
        let personAvailableWidth: number = realAvailableWidth / layout.nColumns;
        let personAvailableHeight: number = realAvailableHeight / layout.nRows;
        
        // Calculate person width/height based on width/height available to that person and the aspect ratio
        let personAvailableSpaceAspectRatio = personAvailableWidth / personAvailableHeight;
        let limitingProperty: "width" | "height" = personAvailableSpaceAspectRatio >= this.ASPECT_RATIO ? "width" : "height";
        let personWidth: number = limitingProperty == "height" ? personAvailableWidth : (personAvailableHeight * this.ASPECT_RATIO);
        let personHeight: number = limitingProperty == "width" ? personAvailableHeight : (personAvailableWidth / this.ASPECT_RATIO);
        
        // Calculate person area (in pixels)
        let personArea: number = personWidth * personHeight;
        
        // Final score is person area multiplied by the number of people
        return {
            score: personArea * nPeople,
            personWidth,
            personHeight,
        };
    }
    
    static calculate(nPeople: number, availableWidth: number, availableHeight: number, columnSpacing: number, rowSpacing: number): VideoConferenceLayoutEx {
        this._buildCache();
        let bestLayout: VideoConferenceLayout = null;
        let bestLayoutScore: LayoutScoreWithDetails = { score: 0, personWidth: 0, personHeight: 0 };
        for (let layout of this._cachedLayouts[nPeople]) {
            let score = this._calculateLayoutScoreAndDetails(layout, availableWidth, availableHeight, columnSpacing, rowSpacing, nPeople);
            if (score.score > bestLayoutScore.score) {
                bestLayoutScore = score;
                bestLayout = layout;
            }
        }
        return {
            nColumns: bestLayout.nColumns,
            nRows: bestLayout.nRows,
            personWidth: Math.floor(bestLayoutScore.personWidth - 5),
            personHeight: Math.floor(bestLayoutScore.personHeight - 5),
        };
    }
    
}
