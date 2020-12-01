export interface Options {
    dirty?: boolean;
    freeze?: boolean;
    delayedClose?: boolean;
}
export interface CloseEvent {
    prevented: boolean;
    type: string;
    preventDefault: () => void;
    isPrevented: () => boolean;
}
export interface WindowStateListener {
    onStateChange: (state: ChangeState) => void;
}
export interface ChangeState {
    id: string;
    state: string;
    time: number;
}