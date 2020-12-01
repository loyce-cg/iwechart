import * as $ from "jquery";

export interface Expression {
    get: Function;
    set: Function;
}

export class Scope<T> {
    
    $e: JQuery;
    data: T;
    models: Binding<T>[];
    
    constructor($e: JQuery, data: T, public postCallback?: () => any) {
        this.$e = $e;
        this.data = data;
        this.models = [];
        this.$e.find("[vf-model],[vf-click],[vf-visible],[vf-disabled],[vf-readonly],[vf-class]").each((_i, e) => {
            let $e = $(e);
            if ($e[0].hasAttribute("vf-model")) {
                let expression = $e.attr("vf-model");
                if ($e.prop("tagName") == "INPUT") {
                    let type = $e.attr("type");
                    if (type == "radio") {
                        this.models.push(new Radio($e, this, expression));
                    }
                    else if (type == "checkbox") {
                        this.models.push(new Checkbox($e, this, expression));
                    }
                    else {
                        this.models.push(new Input($e, this, expression));
                    }
                }
                else if ($e.prop("tagName") == "TEXTAREA") {
                    this.models.push(new Input($e, this, expression));
                }
                else if ($e.prop("tagName") == "SELECT") {
                    this.models.push(new Select($e, this, expression));
                }
                else {
                    this.models.push(new Text($e, this, expression));
                }
            }
            if ($e[0].hasAttribute("vf-click")) {
                let expression = $e.attr("vf-click");
                this.models.push(new Click($e, this, expression));
            }
            if ($e[0].hasAttribute("vf-visible")) {
                let expression = $e.attr("vf-visible");
                this.models.push(new Visible($e, this, expression));
            }
            if ($e[0].hasAttribute("vf-disabled")) {
                let expression = $e.attr("vf-disabled");
                this.models.push(new Disabled($e, this, expression));
            }
            if ($e[0].hasAttribute("vf-readonly")) {
                let expression = $e.attr("vf-readonly");
                this.models.push(new Readonly($e, this, expression));
            }
            if ($e[0].hasAttribute("vf-class")) {
                let expression = $e.attr("vf-class");
                this.models.push(new Class($e, this, expression));
            }
        });
        if (this.postCallback) {
            this.postCallback();
        }
    }
    
    setData(data: T): void {
        for (let key in data) {
            (<any>this.data)[key] = (<any>data)[key];
        }
        this.onChange();
    }
    
    onChange(model?: Binding<T>): void {
        this.models.forEach(m => {
            if (m != model) {
                m.refresh();
            }
        });
        if (this.postCallback) {
            this.postCallback();
        }
    }
    
    compile(code: string, args?: string): Expression {
        let getter: Function,  setter: Function;
        if (code.substring(0, 1) == "{") {
            let getterCode = "getter = function(" + (args || "") + ") { return " + code.substr(1, code.length - 2) + "; }";
            eval(getterCode);
            return {
                get: getter.bind(this.data),
                set: () => {}
            };
        }
        else {
            let getterCode = "getter = function(" + (args || "") + ") { return this." + code + "; }";
            eval(getterCode);
            try {
                let setterCode = "setter = function(value) { this." + code + " = value; }";
                eval(setterCode);
            }
            catch (e) {
            }
            return {
                get: getter.bind(this.data),
                set: typeof(setter) == "undefined" ? () => {} : setter.bind(this.data)
            };
        }
    }
}

export class Binding<T> {
    
    $e: JQuery;
    scope: Scope<T>;
    expression: Expression;
    
    constructor($e: JQuery, scope: Scope<T>, expression: string, args?: string) {
        this.$e = $e;
        this.scope = scope;
        this.expression = this.scope.compile(expression, args);
    }
    
    refresh(): void {
    }
}

export class Class<T> extends Binding<T> {
    
    constructor($e: JQuery, scope: Scope<T>, expression: string) {
        super($e, scope, "{" + expression + "}");
        this.refresh();
    }
    
    refresh(): void {
        let map = this.expression.get();
        for (var name in map) {
            this.$e.toggleClass(name, map[name]);
        }
    }
}

export class Click<T> extends Binding<T> {
    
    constructor($e: JQuery, scope: Scope<T>, expression: string) {
        super($e, scope, expression, "event");
        $e.bind("click", this.onClick.bind(this));
    }
    
    onClick(event: MouseEvent): void {
        this.expression.get(event);
        this.scope.onChange(this);
    }
}

export class Visible<T> extends Binding<T> {
    
    constructor($e: JQuery, scope: Scope<T>, expression: string) {
        super($e, scope, expression);
        this.refresh();
    }
    
    refresh(): void {
        if (this.expression.get()) {
            this.$e.removeClass("hide");
        }
        else {
            this.$e.addClass("hide");
        }
    }
}

export class Disabled<T> extends Binding<T> {
    
    constructor($e: JQuery, scope: Scope<T>, expression: string) {
        super($e, scope, expression);
        this.refresh();
    }
    
    refresh(): void {
        if (this.expression.get()) {
            this.$e.prop("disabled", true);
        }
        else {
            this.$e.prop("disabled", false);
        }
    }
}

export class Readonly<T> extends Binding<T> {
    
    constructor($e: JQuery, scope: Scope<T>, expression: string) {
        super($e, scope, expression);
        this.refresh();
    }
    
    refresh(): void {
        if (this.expression.get()) {
            this.$e.prop("readonly", true);
        }
        else {
            this.$e.prop("readonly", false);
        }
    }
}

export class Text<T> extends Binding<T> {
    
    constructor($e: JQuery, scope: Scope<T>, expression: string) {
        super($e, scope, expression);
        this.refresh();
    }
    
    refresh(): void {
        this.$e.html(this.expression.get());
    }
}

export class Input<T> extends Binding<T> {
    
    constructor($e: JQuery, scope: Scope<T>, expression: string) {
        super($e, scope, expression);
        $e.bind("input", this.onChange.bind(this));
        this.refresh();
    }
    
    onChange(): void {
        this.expression.set(<string>this.$e.val());
        this.scope.onChange(this);
    }
    
    refresh(): void {
        this.$e.val(this.expression.get());
    }
}

export class Select<T> extends Input<T> {
    
    constructor($e: JQuery, scope: Scope<T>, expression: string) {
        super($e, scope, expression);
        $e.bind("change", this.onChange.bind(this));
        this.refresh();
    }
    
    onChange(): void {
        this.expression.set(<string>this.$e.val());
        this.scope.onChange(this);
    }
    
    refresh(): void {
        this.$e.val(this.expression.get());
    }
}

export class Radio<T> extends Binding<T> {
    
    constructor($e: JQuery, scope: Scope<T>, expression: string) {
        super($e, scope, expression);
        $e.bind("change", this.onChange.bind(this));
        this.refresh();
    }
    
    onChange(): void {
        if ((<HTMLInputElement>this.$e[0]).checked) {
            this.expression.set(<string>this.$e.val());
            this.scope.onChange(this);
        }
    }
    
    refresh(): void {
        (<HTMLInputElement>this.$e[0]).checked = this.expression.get() == (<string>this.$e.val());
    }
}

export class Checkbox<T> extends Binding<T> {
    
    constructor($e: JQuery, scope: Scope<T>, expression: string) {
        super($e, scope, expression);
        $e.bind("change", this.onChange.bind(this));
        this.refresh();
    }
    
    onChange(): void {
        this.expression.set((<HTMLInputElement>this.$e[0]).checked);
        this.scope.onChange(this);
    }
    
    refresh(): void {
        (<HTMLInputElement>this.$e[0]).checked = this.expression.get();
    }
}
