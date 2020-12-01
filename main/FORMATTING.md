# Formatowanie kodu w privfs-mail-client

### 1. Ogólne zasady
- Wcięcia za pomocą spacji
- Rozmiar wcięć to 4 dla kodu typescript i 2 dla html i css/less
- Puste linie zachowują wcięcia
- Jeżeli linia jest zbyt długa łamiemy ją

### 2. Kododwanie
- Każda klasa powinna być w osobnym pliku
- Każda klasa powinna byc wyeksportowana poprzez plik index.ts znajdujący się w tym samym katalogu co klasa
- Dodatkowe typy np. interfejsy powinny być zdefiniowane w pliku app/src/Types.ts
- Można używać consol.log do developingu, ale nie wrzucamy console.log w commicie, jak chcemy zachować loggera w commicie to używamy Logger z modułu simlito-logger
- Nie zostawiamy martwego kodu w komentarzach. Do starego kodu mamy git, a jeżeli chcemy zachować nieskomitowany kod można zrobić, commita pośredniego z tym kodem, który chcemy zachować i następnego commit, który ten kod usuwa

### 3. Zasady formatowania
- Każde wyrażenie kończymy średnikiem
```
a = 6;
tab.forEach(x => {
    console.log(x);
});
```
- Zawsze używamy podwójnego cudzysłowia do stringów, chyba że string zawiera html, wtedy używamy pojedynczego
```
str = "some text";
html = '<h1 id="my-header">Some html</h1>';
```
- Każda metoda powinna mieć określony explicite typ zwracany
```
class Foo {
    
    ...
    
    methodX(): string {
        return this.x;
    }
}
```
- Po słowie kluczowym zawsze jest spacja np.
```
for (...
if (...
while (...
catch (...
```
- Nie ma jednolinijkowych `for`, czy `if` zawsze używamy klamry
```
if (...) {
    ...
}
```
- Przed klamrą otwierającą zawsze spacja
```
for (...) {
if (...) {
try {
catch (...) {
```
- Zawsze dodajemy spacje w przypisaniach i między operatorami binarnymi
```
a = b
a += b
a + b
a - b
```
- Brak spacji przy operatorach unary
```
a++
++a
-a
```
- Nie tworzymy obiektu w jednej linii, chyba, że zawiera tylko jedno, dwa pola i nie powoduje to stworzenia zbyt długiej linii
```
a = {
    b: 9,
    y: "asd",
    z: 324
};
b = {a: 9};
```
- W `for` po średnikach zawsze dajemy spacje
```
for (let i = 0; i < length; i++) {
    ...
}
```
- Zawsze `else` dajemy w nowej linii, `else if` razem
```
if (...) {
    ...
}
else if (...) {
    ...
}
else {
    ...
}
```
- Preferowany `if-else` zamiast `switch`
- Podczas określania typu po dwukropku zawsze dajemy spację
```
let a: string;
```
- Wewnątrz nawiasów nie dajemy spacji
```
Źle
if ( a == b ) {
( a + b ) * c
tab.forEach( x => {

 Dobrze
if (a == b) {
(a + b) * c
tab.forEach(x => {
```