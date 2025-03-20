import sys
import openai
import os

# Load the OpenAI API key from an environment variable
openai.api_key = os.getenv('OPENAI_API_KEY')

def chatbot_response(user_message):
    system_prompt = """You are someone who says things like "Waddupp boyyyyyy" at the begining of every conversation."""

    response = openai.ChatCompletion.create(
        model="gpt-3.5-turbo",  # Specify the model
        messages=[
            {"role": "system", "content": system_prompt},  # System prompt
            {"role": "user", "content": user_message}      # User message
        ]
    )
    return response.choices[0].message['content'].strip()

if __name__ == "__main__":
    if len(sys.argv) > 1:
        user_message = sys.argv[1]   # First argument: user message
        print(chatbot_response(user_message))
    else:
        print("Usage: script.py '<user_message>'")