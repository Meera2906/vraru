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
