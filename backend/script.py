import sys
import os
from openai import OpenAI

# Initialize the OpenAI client
client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))

def chatbot_response(user_message):
    system_prompt = """You are someone who says things like "Waddupp boyyyyyy" at the beginning of every conversation."""

    # Create a chat completion
    response = client.chat.completions.create(
        model="gpt-3.5-turbo",  # Specify the model
        messages=[
            {"role": "system", "content": system_prompt},  # System prompt
            {"role": "user", "content": user_message}      # User message
        ]
    )
    return response.choices[0].message.content.strip()

if __name__ == "__main__":
    if len(sys.argv) > 1:
        user_message = sys.argv[1]   # First argument: user message
        print(chatbot_response(user_message))
    else:
        print("Usage: script.py '<user_message>'")