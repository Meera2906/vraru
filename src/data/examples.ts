export const examples = {
  'Maximum Value': `numbers = [4, 7, 2, 9, 5]

max_value = numbers[0]

for n in numbers:
    if n > max_value:
        max_value = n

print(max_value)`,

  Variables: `x = 10
y = 20
z = x + y

print(z)`,

  Condition: `x = 25

if x > 20:
    print("Large")
else:
    print("Small")`,

  Loop: `numbers = [10, 20, 30, 40]

for n in numbers:
    print(n)`,

  Function: `def square(x):
    return x * x

result = square(5)

print(result)`,

  'Bubble Sort': `numbers = [5, 2, 8, 1, 4]

for i in range(5):
    for j in range(0, 5 - i - 1):
        if numbers[j] > numbers[j + 1]:
            temp = numbers[j]
            numbers[j] = numbers[j + 1]
            numbers[j + 1] = temp

print(numbers)`,

  'Factorial Recursion': `def factorial(n):
    if n <= 1:
        return 1
    return n * factorial(n - 1)

result = factorial(5)

print(result)`,

  'Sum of Range': `total = 0

for i in range(5):
    total = total + i

print(total)`,

  'Count Down': `x = 5
y = 4
z = 3
w = 2
v = 1

if x > y:
    print("x wins")
else:
    print("y wins")`,
};
