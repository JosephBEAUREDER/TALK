import sys

def say_hello(name):
    return f"Hello, {name} from Python!"

if __name__ == "__main__":
    name = sys.argv[1] if len(sys.argv) > 1 else "World"
    print(say_hello(name))