import { StaticDaysRenderer } from "./StaticDaysRenderer";

export class SingleWeekRenderer extends StaticDaysRenderer {
    
    getRendererName(): string {
        return "singleweek";
    }
    
    getVisibleDays(): Date[] {
        let dow = (this.selectedDate.getDay() + 6) % 7;
        let days: Date[] = [];
        for (let i = 0; i < 7; ++i) {
            let dt = new Date(this.selectedDate.getFullYear(), this.selectedDate.getMonth(), this.selectedDate.getDate() + i - dow);
            days.push(dt);
        }
        return days;
    }
    
    getPrevNextAbsDelta(): number {
        return 7;
    }
    
}
