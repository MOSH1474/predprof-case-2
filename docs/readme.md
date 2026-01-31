erDiagram
  USER ||--o{ REVIEW : writes
  DISH ||--o{ REVIEW : receives
  MENU ||--o{ REVIEW : context
  USER ||--o{ PAYMENT : makes
  MENU ||--o{ PAYMENT : for
  MENU ||--o{ MENU_ITEM : has
  DISH ||--o{ MENU_ITEM : includes
  USER ||--o{ MEAL_ISSUE : receives
  MENU ||--o{ MEAL_ISSUE : for
  USER ||--o{ MEAL_ISSUE : serves
  USER ||--o{ USER_ALLERGIES : has
  ALLERGY ||--o{ USER_ALLERGIES : includes
  DISH ||--o{ DISH_ALLERGIES : has
  ALLERGY ||--o{ DISH_ALLERGIES : contains
  PRODUCT ||--o{ INVENTORY_TRANSACTION : movements
  USER ||--o{ INVENTORY_TRANSACTION : created_by
  PURCHASE_REQUEST ||--o{ PURCHASE_REQUEST_ITEM : includes
  PRODUCT ||--o{ PURCHASE_REQUEST_ITEM : requested
  USER ||--o{ PURCHASE_REQUEST : requested_by
  USER ||--o{ PURCHASE_REQUEST : approved_by
  NOTIFICATION ||--o{ USER_NOTIFICATION : recipients
  USER ||--o{ USER_NOTIFICATION : receives
  USER ||--o{ NOTIFICATION : created_by

  USER {
    int id PK
    string email
    string full_name
    string password_hash
    string role "student|cook|admin"
    text dietary_preferences
    bool is_active
    datetime created_at
  }

  ALLERGY {
    int id PK
    string name
    string description
  }

  USER_ALLERGIES {
    int user_id PK, FK
    int allergy_id PK, FK
  }

  DISH_ALLERGIES {
    int dish_id PK, FK
    int allergy_id PK, FK
  }

  DISH {
    int id PK
    string name
    text description
    bool is_active
  }

  MENU {
    int id PK
    date menu_date
    string meal_type "breakfast|lunch"
    string title
    decimal price
    datetime created_at
  }

  MENU_ITEM {
    int id PK
    int menu_id FK
    int dish_id FK
    decimal portion_size
    int planned_qty
    int remaining_qty
  }

  REVIEW {
    int id PK
    int user_id FK
    int dish_id FK
    int menu_id FK
    int rating
    text comment
    datetime created_at
  }

  PAYMENT {
    int id PK
    int user_id FK
    int menu_id FK
    decimal amount
    string currency
    string payment_type
    string status
    datetime paid_at
    date period_start
    date period_end
    datetime created_at
  }

  MEAL_ISSUE {
    int id PK
    int user_id FK
    int menu_id FK
    int served_by_id FK
    string status
    datetime served_at
    datetime confirmed_at
    datetime created_at
  }

  PRODUCT {
    int id PK
    string name
    string unit
    string category
    bool is_active
  }

  INVENTORY_TRANSACTION {
    int id PK
    int product_id FK
    decimal quantity
    string direction
    string reason
    int created_by_id FK
    datetime created_at
  }

  PURCHASE_REQUEST {
    int id PK
    int requested_by_id FK
    int approved_by_id FK
    string status
    string note
    datetime requested_at
    datetime decided_at
  }

  PURCHASE_REQUEST_ITEM {
    int id PK
    int purchase_request_id FK
    int product_id FK
    decimal quantity
    decimal unit_price
  }

  NOTIFICATION {
    int id PK
    string title
    text body
    int created_by_id FK
    datetime created_at
  }

  USER_NOTIFICATION {
    int id PK
    int user_id FK
    int notification_id FK
    datetime read_at
    datetime created_at
  }
