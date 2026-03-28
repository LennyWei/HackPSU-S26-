from flask import Flask
from flask_cors import CORS

app = Flask(__name__)
CORS(app)


# --- Lobby ---
@app.route("/lobby", methods=["GET"])
def get_lobby():
    # result lobby states
    pass

# --- Shop ---
@app.route("/shop", methods=["GET"])
def get_shop():
    #return available items
    pass

# --- Battle phase ---
@app.route("/battle/start", methods=["POST"])
def start_battle():
    # trigger the battle
    pass

@app.route("/health")
def health():
    return {"status": "Backend alive!"}

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)