import os
from flask import Flask, request, jsonify
from flask_cors import CORS
import chromadb
from keras_facenet import FaceNet
from mtcnn import MTCNN
import cv2
import numpy as np

app = Flask(__name__)
CORS(app)
embedder = FaceNet()
detector = MTCNN()

# def cosine_similarity(emb1, emb2):
#     """Compute cosine similarity between two embeddings"""
#     return np.dot(emb1, emb2) / (np.linalg.norm(emb1) * np.linalg.norm(emb2))

#Home Screen

chroma_client = chromadb.PersistentClient(path="./chroma_data")

@app.route('/api/classrooms', methods=['GET'])
def get_classrooms():
    """Return all classroom (collection) names."""
    collections = chroma_client.list_collections()
    class_names = [col.name for col in collections]
    return jsonify(class_names), 200

@app.route('/api/classrooms', methods=['POST'])
def create_classroom():
    """Create a new classroom (collection)."""
    data = request.json
    class_name = data.get("name")

    if not class_name:
        return jsonify({"error": "Classroom name is required"}), 400

    existing = [c.name for c in chroma_client.list_collections()]
    if class_name in existing:
        return jsonify({"error": "Classroom already exists"}), 400

    chroma_client.create_collection(name=class_name)
    return jsonify({"message": f"Classroom '{class_name}' created successfully"}), 201

@app.route('/api/classrooms/<string:old_name>', methods=['PUT'])
def edit_classroom(old_name):
    """Rename an existing classroom (collection)."""
    data = request.json
    new_name = data.get("name")

    if not new_name:
        return jsonify({"error": "New classroom name is required"}), 400

    existing = [c.name for c in chroma_client.list_collections()]
    if old_name not in existing:
        return jsonify({"error": "Classroom not found"}), 404
    if new_name in existing:
        return jsonify({"error": "A classroom with this name already exists"}), 400

    old_col = chroma_client.get_collection(name=old_name)
    items = old_col.get()
    rollnos = items.get("ids", [])
    embeddings = items.get("embeddings", [])
    metadatas = items.get("metadatas", [])

    new_col = chroma_client.create_collection(name=new_name)
    if rollnos:
        new_col.add(ids=rollnos, embeddings=embeddings, metadatas=metadatas)

    chroma_client.delete_collection(name=old_name)
    return jsonify({"message": f"Classroom renamed from '{old_name}' to '{new_name}' successfully"}), 200

@app.route('/api/classrooms/<string:class_name>', methods=['DELETE'])
def delete_classroom(class_name):
    """Delete a classroom (collection)."""
    existing = [c.name for c in chroma_client.list_collections()]
    if class_name not in existing:
        return jsonify({"error": "Classroom not found"}), 404

    chroma_client.delete_collection(name=class_name)
    return jsonify({"message": f"Classroom '{class_name}' deleted successfully"}), 200

#Register Screen

# @app.route("/register/<classroom_name>", methods=["POST"])
# def register_student(classroom_name):
#     """
#     Register a student in a specific classroom.
#     """
#     name = request.form.get("name")
#     images = request.files.getlist("images")
#     if not name:
#         return jsonify({"error": "Name missing"}), 400

#     # ✅ Check if classroom exists in ChromaDB
#     existing_classes = [c.name for c in chroma_client.list_collections()]
#     if classroom_name not in existing_classes:
#         return jsonify({"error": f"Classroom '{classroom_name}' not found"}), 404

#     # # ✅ Placeholder: add your own embedding generation logic here later
#     # embedding = [0.0] * 512  # Dummy embedding

#     # # ✅ Add student to classroom collection
#     # collection = chroma_client.get_collection(name=classroom_name)
#     # collection.add(
#     #     ids=[name],
#     #     embeddings=[embedding],
#     #     metadatas=[{"name": name}],
#     # )

#     for file in images:
#         image_bytes = file.read()
#         img = cv2.imread(image_bytes)
#         img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
#         detections = detector.detect_faces(img_rgb)
#         x, y, w, h = detections[0]['box']
#         face = img_rgb[y:y+h, x:x+w]
#         face = cv2.resize(face, (160, 160))
#         embedding = embedder.embeddings([face])[0]
#         collection = chroma_client.get_collection(name=classroom_name)
#         collection.add(
#             ids=[name],              # unique student identifier
#             embeddings=[embedding],
#             metadatas=[{"name": name}]
#         )

#     return jsonify({"message": f"Student '{name}' registered successfully in '{classroom_name}'"}), 200

@app.route("/register/<classroom_name>", methods=["POST"])
def register_student(classroom_name):
    """
    Register a student in a specific classroom — stores 3 embeddings per student.
    Each image is stored as: studentname_1, studentname_2, studentname_3
    """
    name = request.form.get("name")
    images = request.files.getlist("images")
    if not name:
        return jsonify({"error": "Name missing"}), 400
    if not images or len(images) != 3:
        return jsonify({"error": "Exactly 3 images required"}), 400

    # ✅ Check if classroom exists in ChromaDB
    existing_classes = [c.name for c in chroma_client.list_collections()]
    if classroom_name not in existing_classes:
        return jsonify({"error": f"Classroom '{classroom_name}' not found"}), 404

    collection = chroma_client.get_collection(name=classroom_name)

    # ✅ Process each image and generate embeddings
    for idx, file in enumerate(images, start=1):
        # Read uploaded file bytes into an image
        image_bytes = np.frombuffer(file.read(), np.uint8)
        img = cv2.imdecode(image_bytes, cv2.IMREAD_COLOR)
        if img is None:
            return jsonify({"error": f"Failed to read image {idx}"}), 400

        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

        # Detect faces using MTCNN
        detections = detector.detect_faces(img_rgb)
        if not detections:
            return jsonify({"error": f"No face detected in image {idx}"}), 400

        x, y, w, h = detections[0]['box']
        face = img_rgb[y:y + h, x:x + w]
        face = cv2.resize(face, (160, 160))

        # Generate embedding using FaceNet
        embedding = embedder.embeddings([face])[0]

        # Use unique ID per image (e.g., student1_1, student1_2, student1_3)
        student_id = f"{name}_{idx}"
        # Add to ChromaDB collection
        collection.add(
            ids=[student_id],
            embeddings=[embedding.tolist()],
            metadatas=[{"name": name, "image_index": idx}]
        )

    return jsonify({"message": f"Student '{name}' registered successfully in '{classroom_name}'"}), 200


@app.route("/students/<classroom>", methods=["GET"])
def get_students(classroom):
    """Return all students in a specific classroom"""
    # Check if classroom exists
    existing_classes = [c.name for c in chroma_client.list_collections()]
    if classroom not in existing_classes:
        return jsonify({"error": "Classroom not found"}), 404

    # Fetch all students from this class
    collection = chroma_client.get_collection(name=classroom)
    items = collection.get()
    student_names = items.get("ids", [])
    
    return jsonify({"students": student_names}), 200


@app.route("/students/<classroom>/<name>", methods=["DELETE"])
def delete_student(classroom, name):
    """Delete a student from a specific classroom"""
    # Check if classroom exists
    existing_classes = [c.name for c in chroma_client.list_collections()]
    if classroom not in existing_classes:
        return jsonify({"error": "Classroom not found"}), 404

    collection = chroma_client.get_collection(name=classroom)
    try:
        collection.delete(ids=[name])
        return jsonify({
            "message": f"Student '{name}' deleted successfully from '{classroom}'"
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

#Recognize Screen

# @app.route("/recognize/<classroom>", methods=["POST"])
# def recognize_student(classroom):
#     """
#     Recognize students in a specific classroom.
#     Receives an image file and returns the recognized student names.
#     No file saving; image is processed in memory.
#     """
#     # Validate file
#     if "file" not in request.files:
#         return jsonify({"error": "No file uploaded"}), 400

#     file = request.files["file"]
#     if file.filename == "":
#         return jsonify({"error": "Empty filename"}), 400

#     # Check if classroom exists
#     existing_classes = [c.name for c in chroma_client.list_collections()]
#     if classroom not in existing_classes:
#         return jsonify({"error": "Classroom not found"}), 404
#     recognized_students = []
#     # Read image content in memory
#     image_bytes = file.read()
#     npimg = np.frombuffer(image_bytes, np.uint8)
#     img = cv2.imdecode(npimg, cv2.IMREAD_COLOR)
#     detections = detector.detect_faces(img)
#     collection = chroma_client.get_collection(name=classroom)
#     for det in detections:
#         x, y, w, h = det['box']
#         face = img[y:y+h, x:x+w]
#         face = cv2.resize(face, (160, 160))

#         # Get embedding for this face
#         embedding = embedder.embeddings([face])[0]

#         # Query ChromaDB to find the most similar student
#         results = collection.query(
#             query_embeddings=[embedding],
#             n_results=1  # get the top match
#         )

#         if results['distances'] and results['distances'][0][0] >= 0.7:
#             recognized_students.append(results['ids'][0][0])

#     # For now, return all student names in this classroom as dummy response
#     # items = collection.get()
#     # recognized_students = items.get("ids", [])  # list of student names
#     return jsonify({
#         "count": len(recognized_students),
#         "names": recognized_students
#     }), 200

@app.route("/recognize/<classroom>", methods=["POST"])
def recognize_student(classroom):
    """
    Recognize students in a specific classroom using FaceNet embeddings and ChromaDB.
    """
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "Empty filename"}), 400

    existing_classes = [c.name for c in chroma_client.list_collections()]
    if classroom not in existing_classes:
        return jsonify({"error": "Classroom not found"}), 404

    image_bytes = file.read()
    npimg = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(npimg, cv2.IMREAD_COLOR)
    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

    detections = detector.detect_faces(img_rgb)
    if not detections:
        print("⚠️ No faces detected in the image.")
        return jsonify({"count": 0, "names": []}), 200

    collection = chroma_client.get_collection(name=classroom)
    print(f"🧠 Found {collection.count()} embeddings in classroom '{classroom}'")

    recognized_students = []
    threshold = 0.6

    for det in detections:
        x, y, w, h = det['box']
        face = img_rgb[y:y+h, x:x+w]
        face = cv2.resize(face, (160, 160)) 
        embedding = embedder.embeddings([face])[0].tolist()

        # Query the most similar embedding
        results = collection.query(query_embeddings=[embedding], n_results=1)

        if results["distances"] and results["distances"][0][0] <= threshold:
            matched_name = results["metadatas"][0][0]["name"]
            recognized_students.append(matched_name)
            print(f"✅ Recognized: {matched_name} (distance={results['distances'][0][0]:.3f})")
        else:
            print(f"❌ No match (distance={results['distances'][0][0]:.3f})")
        
        # Store faces in a folder with the matched name. 

    return jsonify({
        "count": len(recognized_students),
        "names": recognized_students
    }), 200


#Attendance Screen



#Registering Students Externally
def bulk_register_students(dataset_path: str, classroom_name: str = "DefaultClass"):
    """
    Registers multiple students (each having a folder of images)
    into the given classroom using the existing chroma_client instance.
    """

    # ✅ Create collection if not exists
    existing_classes = [c.name for c in chroma_client.list_collections()]
    if classroom_name not in existing_classes:
        chroma_client.create_collection(name=classroom_name)
    collection = chroma_client.get_collection(name=classroom_name)

    print(f"\n🚀 Starting bulk registration for classroom: {classroom_name}")

    # ✅ Loop through each student folder
    for student_name in os.listdir(dataset_path):
        student_folder = os.path.join(dataset_path, student_name)
        if not os.path.isdir(student_folder):
            continue

        print(f"\n📸 Registering student: {student_name}")
        image_files = [f for f in os.listdir(student_folder) if f.lower().endswith(('.jpg', '.jpeg', '.png'))]

        for idx, img_name in enumerate(image_files, start=1):
            img_path = os.path.join(student_folder, img_name)
            img = cv2.imread(img_path)
            if img is None:
                print(f"⚠️ Skipping {img_path} (unreadable)")
                continue

            img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            detections = detector.detect_faces(img_rgb)
            if not detections:
                print(f"⚠️ No face detected in {img_path}")
                continue

            x, y, w, h = detections[0]['box']
            face = img_rgb[y:y+h, x:x+w]
            face = cv2.resize(face, (160, 160))

            # Get FaceNet embedding
            embedding = embedder.embeddings([face])[0]

            # Unique ID for each image
            unique_id = f"{student_name}_{idx}"

            # ✅ Add to ChromaDB
            collection.add(
                ids=[unique_id],
                embeddings=[embedding],
                metadatas=[{"name": student_name}]
            )

            print(f"✅ Added {unique_id}")

    print("\n🎯 All students registered successfully into ChromaDB!")


if __name__ == '__main__':
    #bulk_register_students(r"C:\Users\sarayu sree\Pictures\2nd year-B section\2nd year-B section")
    app.run(host='0.0.0.0', port=5000)
