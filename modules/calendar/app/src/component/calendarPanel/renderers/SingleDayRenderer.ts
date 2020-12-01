import { StaticDaysRenderer } from "./StaticDaysRenderer";

export class SingleDayRenderer extends StaticDaysRenderer {
    
    getRendererName(): string {
        return "singleday";
    }
    
    getVisibleDays(): Date[] {
        let days: Date[] = [];
        for (let i = 0; i < 1; ++i) {
            let dt = new Date(this.selectedDate.getFullYear(), this.selectedDate.getMonth(), this.selectedDate.getDate() + i);
            days.push(dt);
        }
        return days;
    }
    
    getPrevNextAbsDelta(): number {
        return 1;
    }
    
}
