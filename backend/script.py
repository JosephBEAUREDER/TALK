import sys

def process_name(name):
    return f"{name} is a very beautiful person"

if __name__ == "__main__":
    if len(sys.argv) > 1:
        name = sys.argv[1]
        print(process_name(name))
    else:
        print("No name provided")